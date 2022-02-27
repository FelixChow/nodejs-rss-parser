module.exports = {
  solr: {
    host: process.env.SOLR_HOST || "localhost",
    port: process.env.SOLR_PORT || 8983,
    core: process.env.SOLR_CORE || "playground",
  },
  dbconfig: {
    connectionLimit: 10,
    host: process.env.DB_CONFIG_HOST || "localhost",
    port: process.env.DB_CONFIG_PORT || 3306,
    user: process.env.DB_CONFIG_USER || "root",
    password: process.env.DB_CONFIG_PASSWORD || "password",
    database: process.env.DB_CONFIG_DATABASE || "rss",
  },
  kafkaconfig: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  },
  solr_grpc: {
    host: process.env.SOLR_GRPC_HOST || "0.0.0.0",
    port: process.env.SOLR_GRPC_PORT || 50051,
  },
};
