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

const yaml = require("js-yaml");
const fs = require("fs");
const axios = require("axios").default;
const { solr, dbconfig, solr_service } = yaml.load(
  fs.readFileSync(__dirname + "/../config.yaml", "utf-8")
);
const mysql = require("mysql2/promise");
const solrquery = `http://${solr.host}:${solr.port}/solr/${solr.core}/update?commit=true`;

async function updateSolr(call, callback) {
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
        callback(null, { success: true, message: "OK" });
      });
  } catch (e) {
    console.error(e);
    callback(null, { success: false, message: e.message });
  }
}

async function cleanSolr(call, callback) {
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
      server.start();
    }
  );
}

main();
