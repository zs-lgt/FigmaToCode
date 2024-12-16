const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function packPlugin() {
  const zip = new JSZip();
  
  // Read and add manifest.json
  const manifestPath = path.join(__dirname, '..', 'manifest.json');
  const manifestContent = fs.readFileSync(manifestPath);
  zip.file('manifest.json', manifestContent);

  // Read and add the plugin build output
  const pluginDistPath = path.join(__dirname, '..', 'apps', 'plugin', 'dist');
  const files = fs.readdirSync(pluginDistPath);
  
  for (const file of files) {
    const filePath = path.join(pluginDistPath, file);
    const fileContent = fs.readFileSync(filePath);
    zip.file(`apps/plugin/dist/${file}`, fileContent);
  }

  // Generate zip file
  const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
  
  // Create dist directory if it doesn't exist
  const distPath = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
  }

  // Write the zip file
  const outputPath = path.join(distPath, 'kamis-figma-plugin.zip');
  fs.writeFileSync(outputPath, zipContent);
  
  console.log(`Plugin package created at: ${outputPath}`);
}

packPlugin().catch(console.error);
