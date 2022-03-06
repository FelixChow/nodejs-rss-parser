# Nodejs Rss Parser

## Introduction
The RSS parser retrieves data from online news media then processes them with users subscribed keywords and return eligible information back to the users.

## Quick start
```
docker run felixchow95/rss_parser
```
## Build
```
docker build . -t rss_parser
```

## Usage
```
docker run rss_parser
```

## Config
```properties
# (default)

# set cron job time to every 15 minutes
CRON_TIME="0 */15 * * * *"

# solr
SOLR_HOST=localhost
SOLR_PORT=8983
SOLR_CORE=playground

# mysql
DB_CONFIG_HOST=localhost
DB_CONFIG_PORT=3306
DB_CONFIG_USER=root
DB_CONFIG_PASSWORD=password
DB_CONFIG_DATABASE=rss

# kafka
KAFKA_BROKERS=localhost:9092

# solr grpc
SOLR_GRPC_HOST=0.0.0.0
SOLR_GRPC_PORT=50051
```