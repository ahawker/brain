---
title: Kafka Rebalance Partitions Cheatsheet
date: 2024-07-23
area: professional
category: Apache Kafka
---
This how-to document is a quick cheatsheet for rebalancing Kafka partitions for expansion (adding more brokers) using standard [[cheatsheet-cli | Kafka CLI]] tools.

You can find this script in Gist form [here](https://gist.github.com/ahawker/a27958f9439d3b7e99ef99b5cf3ecc0e).

```bash
#!/usr/bin/env bash
#
# rebalance-partitions-expand
#
# This script will re-balance all partitions of the specified topics in a Kafka cluster
# with a strategy that assumes one or more new brokers have been added.
#
# This goal of this script is to "expand" the partitions across all the new brokers
# to even out distribution.
#
# Usage:
# env DRYRUN=1 TOPICS=foobar,foobaz ./rebalance-partitions-expand

set -e
set -o pipefail

WATCH_DELAY_SEC=10

# Fetch numeric id's of all brokers in the cluster.
#
# Ex: 3,1,2
kafka_broker_ids() {
  local -r bootstrap_servers="${1}"
  local -r kafka_cfg="${2}"

  local -r result=$(
    kafka-broker-api-versions \
    --bootstrap-server "${bootstrap_servers}" \
    --command-config "${kafka_cfg}" \
    | grep 'id:' \
    | sed -r 's/^.*id: (.*)rack:.*$/\1/' \
    | awk '{$1=$1};1' \
    | paste -s -d, -
  )
  echo "${result}"
}

# Fetch list of all kafka topics we want to potentially re-balance.
#
# Note: This excludes anything starting with '_', so __consumer_offsets.
kafka_topics() {
  local -r bootstrap_servers="${1}"
  local -r kafka_cfg="${2}"
  local -r env_topics="${3}"

  if [ -z "${env_topics}" ]; then
    local -r result=$(
      kafka-topics \
      --bootstrap-server "${bootstrap_servers}" \
      --command-config "${kafka_cfg}" \
      --list
    )
    echo "${result}" | grep -v "^_"
  else
    echo "${env_topics}" | tr ',' '\n' | grep -v "^_"
  fi
}

# Generate .json file that contains all topics we want to re-balance
# in a format that is consumable by 'kafka-reassign-partitions'.
#
# Ex:
# {
#   "version": 1,
#   "topics": [
#     {
#       "topic": "foobar"
#     },
#     {
#       "topic": "foobaz"
#     }
#   ]
# }
kafka_topics_file() {
  local -r topics_list="${1}"
  local -r outfile="${2:-topics-list-file.json}"

  local -r topics_array=$(echo "${topics_list}" | jq -R . | jq -cs)
  echo '{"version": 1}' | jq -r --argjson topics "${topics_array}" '. + {topics: [$topics | .[] | {topic: .}]}' > "${outfile}"
  echo "${outfile}"
}

# Generate a preview of partition reassignments the broker would do, if executed,
# and write it to a file.
#
# Note: This file is meant to be read by a human to determine if the plan is desired.
kafka_reassignment_plan_preview() {
  local -r bootstrap_servers="${1}"
  local -r kafka_cfg="${2}"
  local -r brokers="${3}"
  local -r topics_to_move_file="${4}"
  local -r plan_file="${5}"

  local -r result=$(
    kafka-reassign-partitions \
    --bootstrap-server "${bootstrap_servers}" \
    --command-config "${kafka_cfg}" \
    --topics-to-move-json-file "${topics_to_move_file}" \
    --broker-list "${brokers}" \
    --generate \
    | grep "{"
  )
  echo "${result}" > "${plan_file}"
}

# Fetch list of all active of a partition reassignments.
kafka_reassignment_list_active() {
  local -r bootstrap_servers="${1}"
  local -r kafka_cfg="${2}"

  local -r result=$(
    kafka-reassign-partitions \
    --bootstrap-server "${bootstrap_servers}" \
    --command-config "${kafka_cfg}" \
    --list
  )
  echo "${result}"
}

# Print status of a partition reassignment plan.
kafka_reassignment_print_plan_status() {
  local -r bootstrap_servers="${1}"
  local -r kafka_cfg="${2}"
  local -r changes_file="${3}"

  kafka-reassign-partitions \
  --bootstrap-server "${bootstrap_servers}" \
  --command-config "${kafka_cfg}" \
  --reassignment-json-file "${changes_file}" \
  --preserve-throttles \
  --verify
}

# Pretty print active reassignments.
kafka_reassignment_print_active() {
  local -r bootstrap_servers="${1}"
  local -r kafka_cfg="${2}"
  local -r active=$(kafka_reassignment_list_active "${bootstrap_servers}" "${kafka_cfg}")
  echo "${active}"
}

# Pretty print content from the reassignment plans. This is helpful
# for operators to visualize what brokers are gaining/losing replicas for
# each topic_partition in the re-balance plan.
kafka_reassignment_print_plan() {
  local -r current_file="${1}"
  local -r changes_file="${2}"

  echo "===== [CURRENT] ====="
  cat "${current_file}"
  echo ""
  echo "===== [CHANGES] ====="
  cat "${changes_file}"
  echo ""
  local -r diff=$(jq -csr '
    [
      .[].partitions |
      flatten |
      .[] |
      {
        key: [.topic, .partition] | join("_"),
        replicas: .replicas
      }
    ] |
    group_by(.key)[] |
    [
      {
        topic: .[].key,
        added_to: (.[1].replicas - .[0].replicas),
        removed_from: (.[0].replicas - .[1].replicas)
      }
    ] | .[0] |
    .topic + "\n  + brokers: " + (.added_to | join(", ")) + "\n  - brokers: " + (.removed_from | join(", "))' "${current_file}" "${changes_file}")
  echo "===== [DIFF] ====="
  echo "${diff}"
  echo ""
}

# Execute a partition reassignment plan.
kafka_reassignment_plan_execute() {
  local -r bootstrap_servers="${1}"
  local -r kafka_cfg="${2}"
  local -r changes_file="${3}"

  kafka-reassign-partitions \
  --bootstrap-server "${bootstrap_servers}" \
  --command-config "${kafka_cfg}" \
  --reassignment-json-file "${changes_file}" \
  --execute
}

# Split the generated preview of partition reassignments into two separate files.
#
# Ex: kafka_reassignment_plan_files ${plan_file} current.json planned.json
kafka_reassignment_plan_files() {
  local -r plan_file="${1}"
  local -r current_file="${2}"
  local -r changes_file="${3}"

  local -r current=$(head -n1 "${plan_file}" | jq -rc .)
  local -r changes=$(tail -n1 "${plan_file}" | jq -rc '. | del(.partitions[] | .log_dirs)')

  echo "${current}" > "${current_file}"
  echo "${changes}" > "${changes_file}"
}

# Spin loop to watch kafka reassignment progress; requires user intervention to stop.
kafka_reassignment_watch() {
  local -r bootstrap_servers="${1}"
  local -r kafka_cfg="${2}"
  local -r changes_file="${3}"

  # Initial "watch"; prompt user to fall into watch loop if long running.
  kafka_reassignment_print_active "${bootstrap_servers}" "${kafka_cfg}"
  kafka_reassignment_print_plan_status "${bootstrap_servers}" "${kafka_cfg}" "${changes_file}"

  i=0

  while true; do
    read -rp "Would you like to wait & watch reassignment status (y/n)? " choice
    case "$choice" in
      y|Y )
        for _ in $(seq 5); do
          echo "===== [WATCH ${i}] ====="
          kafka_reassignment_print_active "${bootstrap_servers}" "${kafka_cfg}"
          kafka_reassignment_print_plan_status "${bootstrap_servers}" "${kafka_cfg}" "${changes_file}"

          local -r active_reassignments=$(kafka_reassignment_list_active "${bootstrap_servers}" "${kafka_cfg}")
          local -r has_active_reassignments=$(echo "${active_reassignments}" | grep -v 'No partition reassignments found')
          if [ -z "${has_active_reassignments}" ]; then
            echo "No reassignments currently active; exiting watch loop"
            break
          fi

          sleep "${WATCH_DELAY_SEC}"
        done
        ;;
      n|N )
        exit 0
        ;;
      * )
        echo "misunderstood input; exiting..."
        exit 0
        ;;
    esac
    i=$((i+1))
  done
}

main() {
  local -r bootstrap_servers="${KAFKA_BOOTSTRAP_SERVERS}"
  local -r kafka_cfg="${KAFKA_CONFIG_PATH}"
  local -r plan_file="reassignment.plan"
  local -r current_file="current.json"
  local -r changes_file="changes.json"

  local -r brokers=$(kafka_broker_ids "${bootstrap_servers}" "${kafka_cfg}")
  local -r topics=$(kafka_topics "${bootstrap_servers}" "${kafka_cfg}" "${TOPICS}")
  local -r topics_list_file=$(kafka_topics_file "${topics}")

  local -r active_reassignments=$(kafka_reassignment_list_active "${bootstrap_servers}" "${kafka_cfg}")
  local -r has_active_reassignments=$(echo "${active_reassignments}" | grep -v 'No partition reassignments found')

  if [ -n "${has_active_reassignments}" ]; then
    echo "At least one reassignment currently active; skipping this request!"
    echo "${active_reassignments}"
    exit 1
  fi

  kafka_reassignment_plan_preview "${bootstrap_servers}" "${kafka_cfg}" "${brokers}" "${topics_list_file}" "${plan_file}"
  kafka_reassignment_plan_files "${plan_file}" "${current_file}" "${changes_file}"
  kafka_reassignment_print_plan "${current_file}" "${changes_file}"

  echo "!!! WARNING !!! Throttling is disabled! If you re-balance hundreds of partitions you may cause production impact!!"
  echo "If the plan is too large; it is HIGHLY RECOMMENDED you specify a smaller subset of topics and run multiple re-balance plans."

  read -rp "Continue (y/n)? " choice
  case "$choice" in
    y|Y )
      if [ -z "${DRYRUN}" ]; then
        kafka_reassignment_plan_execute "${bootstrap_servers}" "${kafka_cfg}" "${changes_file}"
        kafka_reassignment_watch "${bootstrap_servers}" "${kafka_cfg}" "${changes_file}"
      else
        echo "DRYRUN enabled; skipping rebalance plan execution"
      fi
      ;;
    n|N )
      exit 0
      ;;
    * )
      echo "misunderstood input; exiting..."
      exit 1
      ;;
  esac
}

main "$@"
```