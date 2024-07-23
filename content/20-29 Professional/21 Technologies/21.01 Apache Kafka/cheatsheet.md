---
title: Kafka CLI Cheatsheet
date: 2024-07-22
area: professional
---

# Kafka CLI Cheatsheet

This how-to document is a quick cheatsheet for interacting/managing Kafka via the standard CLI tools.

> [!info]
> Check out [ahawker/docker-kafka-definitive-guide-v2](https://github.com/ahawker/docker-kafka-definitive-guide-v2 "https://github.com/ahawker/docker-kafka-definitive-guide-v2") for a quick Kafka cluster setup.

## Setup
### Environment

All commands will expect one or more environment variables to be set.

```bash
export BOOTSTRAP_SERVER=127.0.0.1:29092
export TOPIC=kafka-cheatsheet-topic
export GROUP=kafka-cheatsheet-group
```

### Authentication/Authorization

If you are connecting to a production instance, it’s likely you’ll need SASL/TLS configuration for your secure connection.

For example, you have a file similar to the following and you’ll include the `--command-config kafka.config` on most of your calls.

```bash
$ cat kafka.config

security.protocol=SASL_SSL
sasl.mechanism=SCRAM-SHA-512
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required \
  username="admin" \
  password="xxxxxxxx";
```

## Commands

We'll breakdown commands by entity with some simple examples.

### Topics

#### Create
```bash
kafka-topics \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --topic ${TOPIC} \
  --partitions 1 \
  --replication-factor 1 \
  --create
```
#### Describe
```bash
kafka-topics \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --topic ${TOPIC} \
  --describe
```
#### Delete
```bash
kafka-topics \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --topic ${TOPIC} \
  --delete
```
#### List
```bash
kafka-topics \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --list
```
#### Modify (Topic Partitions)
```bash
kafka-topics \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --alter \
  --topic ${TOPIC} \
  --partitions 4
```
#### Modify (Topic Config)
```bash
kafka-configs \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --alter \
  --entity-type topics \
  --entity-name ${TOPIC} \
  --add-config \
  cleanup.policy=compact
```
### Consumer Groups
#### Describe
```bash
kafka-consumer-groups \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --describe \
  --group ${GROUP}
```
#### Delete
```bash
kafka-consumer-groups \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --delete \
  --group ${GROUP}
```
#### List
```bash
kafka-consumer-groups \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --list
```
#### Reset (Oldest Offset)
```bash
kafka-consumer-groups \
  --bootstrap-server kafka-host:9092 \
  --group ${GROUP} \ 
  --topic ${TOPIC} \
  --reset-offsets \
  --to-earliest \
  --execute
```
#### Reset (Newest Offset)
```bash
kafka-consumer-groups \
  --bootstrap-server kafka-host:9092 \
  --group ${GROUP} \ 
  --topic ${TOPIC} \
  --reset-offsets \
  --to-latest \
  --execute
```
#### Reset (Shift Forward 'N' Messages)
```bash
kafka-consumer-groups \
  --bootstrap-server kafka-host:9092 \
  --group ${GROUP} \ 
  --topic ${TOPIC} \
  --reset-offsets \
  --shift-by 10 \
  --execute
```
#### Reset (Shift Backward 'N' Messages)
```bash
kafka-consumer-groups \
  --bootstrap-server kafka-host:9092 \
  --group ${GROUP} \ 
  --topic ${TOPIC} \
  --reset-offsets \
  --shift-by -500 \
  --execute
```
#### Reset (Shift to approximate timestamp)
```bash
kafka-consumer-groups \
  --bootstrap-server kafka-host:9092 \
  --group ${GROUP} \ 
  --topic ${TOPIC} \
  --reset-offsets \
  --to-datetime 2023-05-24T00:00:00Z \
  --execute
```
### Partitions
#### Rebalance Partitions
```gist
a27958f9439d3b7e99ef99b5cf3ecc0e
```
### Producers
#### Produce (Values Only)
```bash
echo '{"name": "bob"}' | kafka-console-producer \
  --bootstrap-server #{BOOTSTRAP_SERVER} \
  --topic ${TOPIC}
```
#### Produce (Key & Value)
```bash
echo '{"id": "1234"}|{"name": "bob"}' | kafka-console-producer \
  --bootstrap-server #{BOOTSTRAP_SERVER} \
  --topic ${TOPIC} \
  --property "parse.key=true" \
  --property "key.separator=|"
```
### Consumers
#### Consume (Simple)
```bash
kafka-console-consumer \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --topic ${TOPIC}
```
#### Consume (Group)
```bash
kafka-console-consumer \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --topic ${TOPIC}
  --group ${GROUP}
```
#### Consume (With Additional Metadata)
```bash
kafka-console-consumer \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --topic ${TOPIC} \
  --property 'print.key=true' \
  --property 'print.partition=true' \
  --property 'print.offset=true'
```
#### Consume ('N' Messages after specific offset)
```bash
kafka-console-consumer \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --topic ${TOPIC} \
  --offset 38201 \
  --max-messages 10 \
  --timeout-ms 1000
```
### ACL's
#### Create
TODO
#### Delete
```bash
kafka-acls \
  --authorizer kafka.security.auth.SimpleAclAuthorizer \
  --authorizer-properties zookeeper.connect=localhost:2181 \
  --remove \
  --allow-principal User:Bob \
  --allow-principal User:Alice \
  --allow-hosts Host1,Host2 \
  --operations Read,Write \
  --topic ${TOPIC}
```
#### List
```bash
kafka-acls \
  --bootstrap-server ${BOOTSTRAP_SERVER} \
  --list
```