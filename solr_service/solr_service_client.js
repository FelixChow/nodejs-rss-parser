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

async function main() {
  target = "0.0.0.0:50051";
  const client = new solr_proto.SolrService(
    target,
    grpc.credentials.createInsecure()
  );
  await new Promise((resolve, reject) => {
    client.cleanSolr({}, function (err, response) {
      console.log(response);
      resolve(response);
    });
  });
  await new Promise((resolve, reject) => {
    client.updateSolr({}, function (err, response) {
      console.log(response);
      resolve(response);
    });
  });
}

main();
