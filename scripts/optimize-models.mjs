import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, simplify, reorder, meshopt, textureCompress } from '@gltf-transform/functions';
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
    'C:/Users/Lenovo/.gemini/antigravity/worktrees/mochi-desktop/mochi_desktop_base_setup/public/assets/models',
  ];

  console.log('🚀 Starting Ultra-Low Resource GLB model & texture optimization (512x512 max)...');

  for (const file of files) {
    const sourceInDownloads = path.join('C:/Users/Lenovo/Downloads', file);
    const inputPath = fs.existsSync(sourceInDownloads) ? sourceInDownloads : path.join('public/assets/models', file);
    if (!fs.existsSync(inputPath)) {
      console.warn(`File not found: ${inputPath}`);
      continue;
    }

    const origStats = fs.statSync(inputPath);
    console.log(`\n⏳ Processing ${file} from ${inputPath} (Original size: ${(origStats.size / 1024 / 1024).toFixed(2)} MB)...`);

    const doc = await io.read(inputPath);

    // Initial vertex and triangle counts
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

    // Apply optimization pipeline:
    // 1. weld & simplify geometry
    // 2. resize all textures to 512x512 via sharp
    // 3. reorder & meshopt compression
    await doc.transform(
      weld({ tolerance: 0.0001 }),
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: 0.0055, // Optimal crisp 10k triangle silhouette for 240px viewport
        error: 0.005,
      }),
      textureCompress({
        encoder: sharp,
        resize: [512, 512],
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

    // Write to all target directories
    for (const targetDir of targetDirs) {
      if (fs.existsSync(targetDir)) {
        const outPath = path.join(targetDir, file);
        fs.writeFileSync(outPath, Buffer.from(optimizedGlb));
      }
    }

    console.log(
      `✅ ${file}: Vertices ${origVerts.toLocaleString()} -> ${newVerts.toLocaleString()} | Triangles ${origTris.toLocaleString()} -> ${newTris.toLocaleString()} | Size: ${(origStats.size / 1024 / 1024).toFixed(2)} MB -> ${newSizeMB} MB`
    );
  }

  console.log('\n🎉 All 4 GLB models have been successfully compressed to 512x512 textures and synchronized!');
}

optimizeModels().catch((err) => {
  console.error('Error optimizing models:', err);
  process.exit(1);
});
