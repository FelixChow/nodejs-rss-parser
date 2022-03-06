# Solr gRPC

## Introduction
This is a gRPC server handles communication between the [Node-Rss-Parser](https://gitlab.com/FelixChow/nodejs-rss-parser#nodejs-rss-parser) and the solr server

## Quick Start
```
docker run -p 50051:50051 felixchow95/solr_grpc
```
## Build
```bash
docker build . -t solr_grpc
```

## Usage
```
docker run -p 50051:50051 solr_grpc
```

## Config
```properties
# (default)
SERVER_HOST=0.0.0.0
SERVER_PORT=50051

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
```