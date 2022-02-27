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

const client = new solr_proto.SolrService(
  `${process.env.SOLR_GRPC_HOST || "0.0.0.0"}:${
    process.env.SOLR_GRPC_PORT || 50051
  }`,
  grpc.credentials.createInsecure()
);

async function syncSolr() {
  await new Promise((resolve, reject) => {
    client.cleanSolr({}, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  }).catch((e) => {
    console.error(e);
  });
  // always run updateSolr even cleanSolr return error
  return await new Promise((resolve, reject) => {
    client.updateSolr({}, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  }).catch((e) => {
    console.error(e);
  });
}

module.exports = { syncSolr };
