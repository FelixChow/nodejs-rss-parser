const PROTO_PATH = __dirname + "/solr_service.proto";

const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const packageDefination = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const solr_proto = grpc.loadPackageDefinition(packageDefination).solrservice;

const solr = {
  host: process.env.SOLR_HOST || "localhost",
  port: process.env.SOLR_PORT || 8983,
  core: process.env.SOLR_CORE || "playground",
};
const dbconfig = {
  connectionLimit: 10,
  host: process.env.DB_CONFIG_HOST || "localhost",
  port: process.env.DB_CONFIG_PORT || 3306,
  user: process.env.DB_CONFIG_USER || "root",
  password: process.env.DB_CONFIG_PASSWORD || "password",
  database: process.env.DB_CONFIG_DATABASE || "rss",
};
const solr_service = {
  host: process.env.SERVER_HOST || "0.0.0.0",
  port: process.env.SERVER_PORT || 50051,
};

const axios = require("axios").default;
const mysql = require("mysql2/promise");
const solrquery = `http://${solr.host}:${solr.port}/solr/${solr.core}/update?commit=true`;

async function updateSolr(call, callback) {
  console.info(
    new Date().toISOString() + "\t" + call.call.handler.path + "\t--"
  );
  try {
    const conn = await mysql.createConnection(dbconfig);
    const [tags, _] = await conn.execute("SELECT topic, hash_id FROM topic");
    await conn.end();
    await axios
      .post(
        solrquery,
        tags.map(({ topic, hash_id }) => ({ name: topic, id: hash_id }))
      )
      .then(() => {
        callback(null, { success: true, message: JSON.stringify(tags) });
      });
  } catch (e) {
    console.error(e);
    callback(null, { success: false, message: e.message });
  } finally {
    console.info(
      new Date().toISOString() + "\t" + call.call.handler.path + "\t-end-"
    );
  }
}

async function cleanSolr(call, callback) {
  console.info(
    new Date().toISOString() + "\t" + call.call.handler.path + "\t--"
  );
  try {
    await axios
      .post(solrquery, "<delete><query>*:*</query></delete>", {
        headers: { "Content-Type": "application/xml" },
      })
      .then(() => {
        callback(null, { success: true, message: "OK" });
      });
  } catch (e) {
    console.error(e);
    callback(null, { success: false, message: e.message });
  } finally {
    console.info(
      new Date().toISOString() + "\t" + call.call.handler.path + "\t-end-"
    );
  }
}

function main() {
  const server = new grpc.Server();
  server.addService(solr_proto.SolrService.service, {
    updateSolr: updateSolr,
    cleanSolr: cleanSolr,
  });
  server.bindAsync(
    `${solr_service.host}:${solr_service.port}`,
    grpc.ServerCredentials.createInsecure(),
    () => {
      console.info(`Server start at ${solr_service.host}:${solr_service.port}`);
      server.start();
    }
  );
}

main();
