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

We'll breakdown commands by entity.

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
