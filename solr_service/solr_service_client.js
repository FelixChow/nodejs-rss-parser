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

function main() {
  target = "0.0.0.0:50051";
  const client = new solr_proto.SolrService(
    target,
    grpc.credentials.createInsecure()
  );
  client.cleanSolr({}, function (err, response) {
    console.log(response);
  });
  client.updateSolr({}, function (err, response) {
    console.log(response);
  });
}

main();
