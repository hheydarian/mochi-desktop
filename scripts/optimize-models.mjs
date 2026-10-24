import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, simplify, reorder, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

async function optimizeModels() {
  await Promise.all([
    MeshoptDecoder.ready,
    MeshoptEncoder.ready,
    MeshoptSimplifier.ready,
  ]);

  const io = new NodeIO()
    .registerExtensions([KHRMeshQuantization, EXTMeshoptCompression])
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });

  const files = [
    'mochi-idle.glb',
    'mochi-waving.glb',
    'mochi-alert.glb',
    'mochi-sleeping.glb',
  ];

  const targetDirs = [
    'public/assets/models',
    'E:/GitHub/mochi-desktop/public/assets/models',
  ];

  console.log('🚀 Starting GLB model optimization...');

  for (const file of files) {
    const inputPath = path.join('public/assets/models', file);
    if (!fs.existsSync(inputPath)) {
      console.warn(`File not found: ${inputPath}`);
      continue;
    }

    const origStats = fs.statSync(inputPath);
    console.log(`\n⏳ Processing ${file} (Original: ${(origStats.size / 1024 / 1024).toFixed(2)} MB)...`);

    const doc = await io.read(inputPath);

    // Initial counts
    let origTris = 0;
    let origVerts = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (pos) origVerts += pos.getCount();
        const idx = prim.getIndices();
        if (idx) origTris += idx.getCount() / 3;
      }
    }

    // Apply optimization pipeline: weld -> simplify -> reorder -> meshopt
    await doc.transform(
      weld({ tolerance: 0.0001 }),
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: 0.045, // Target ~80k-90k high quality triangles
        error: 0.001,
      }),
      reorder({ encoder: MeshoptEncoder }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' })
    );

    // Final counts
    let newTris = 0;
    let newVerts = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (pos) newVerts += pos.getCount();
        const idx = prim.getIndices();
        if (idx) newTris += idx.getCount() / 3;
      }
    }

    const optimizedGlb = await io.writeBinary(doc);
    const newSizeMB = (optimizedGlb.byteLength / 1024 / 1024).toFixed(2);

    // Write to both target directories
    for (const targetDir of targetDirs) {
      if (fs.existsSync(targetDir)) {
        const outPath = path.join(targetDir, file);
        fs.writeFileSync(outPath, Buffer.from(optimizedGlb));
      }
    }

    console.log(
      `✅ ${file}: Vertices ${origVerts.toLocaleString()} -> ${newVerts.toLocaleString()} | Triangles ${origTris.toLocaleString()} -> ${newTris.toLocaleString()} (-${(((origTris - newTris) / origTris) * 100).toFixed(1)}%) | Size: ${(origStats.size / 1024 / 1024).toFixed(2)} MB -> ${newSizeMB} MB`
    );
  }

  console.log('\n🎉 All 4 GLB models have been successfully optimized and synchronized!');
}

optimizeModels().catch((err) => {
  console.error('Error optimizing models:', err);
  process.exit(1);
});
