import { extractMarkdown } from './src/services/documentParser';
import * as fs from 'fs';
import * as path from 'path';

// Polyfill File if needed (Node < 20)
if (typeof File === 'undefined') {
    global.File = class File extends Blob {
        name: string;
        lastModified: number;

        constructor(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag) {
            super(fileBits, options);
            this.name = fileName;
            this.lastModified = options?.lastModified || Date.now();
        }
    } as any;
}

async function runTest() {
    const filePath = path.resolve('mock_test.md');
    console.log(`Reading file from: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.error('Mock file not found!');
        return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const file = new File([content], 'mock_test.md', { type: 'text/markdown' });

    console.log('--- Starting Extraction Test ---');
    try {
        const result = await extractMarkdown(file);
        console.log('Extraction Successful!');
        console.log('Language:', result.language);
        console.log('Word Count:', result.wordCount);
        console.log('Pages:', result.pages);
        console.log('--- Text Preview ---');
        console.log(result.text.substring(0, 200) + '...');
        console.log('--------------------');

        if (result.language === 'en' && result.wordCount > 0) {
            console.log('✅ TEST PASSED');
        } else {
            console.log('❌ TEST FAILED: Unexpected results');
        }
    } catch (error) {
        console.error('❌ TEST FAILED with error:', error);
    }
}

runTest();
