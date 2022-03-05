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

const { solr, dbconfig, solr_service, } = require('./config');
const axios = require("axios").default;
const mysql = require("mysql2/promise");
const solrUpdate = `http://${solr.host}:${solr.port}/solr/${solr.core}/update?commit=true`;
const solrScan = `http://${solr.host}:${solr.port}/solr/${solr.core}/tag?overlaps=NO_SUB&tagsLimit=5000&fl=id,name,countrycode&wt=json&indent=on`;

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
        solrUpdate,
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
      .post(solrUpdate, "<delete><query>*:*</query></delete>", {
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

async function scanNews(call, callback) {
  console.info(
    new Date().toISOString() + "\t" + call.call.handler.path + "\t--"
  );
  try {
    await axios
      .post(solrScan, `${call.request.content}`, {
        headers: { "Content-Type": "text/plain" },
      })
      .then(async (res) => {
        let { numFound, docs } = res.data.response;
        // res.data.response: {numFound: 1, start: 0, numFoundExact: true, docs: Array(1)}
        if (numFound > 0) {
          tag = docs.map(({ id }) => id);
          callback(null, { found: true, tag });
        } else {
          callback(null, { found: false, tag: [] });
        }
      });
  } catch (e) {
    console.error(e);
    callback(null, { found: false, tag: [] });
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
    scanNews: scanNews,
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
