const fs = require('fs');

function main() {
  console.log('Exporting IICO ABI');
  const input = 'build/contracts/IICO.json';
  const output = 'build/IICO.abi.json';
  const abi = exportAbiForFile(input);
  fs.writeFileSync(output, JSON.stringify(abi, null, 2));
  console.log(`IICO ABI was exported ${output}`);
}

function exportAbiForFile(filename) {
  if (filename.endsWith(".json")) {
    const data = fs.readFileSync(filename);
    const jsonData = JSON.parse(data);
    if (jsonData.hasOwnProperty("abi")) {
      return jsonData["abi"];
    }
  }
  return null;
}

main();
