import asyncio
import os
import json
import websockets
import wave
import subprocess
from dotenv import load_dotenv

load_dotenv('backend/.env')
api_key = os.getenv('GNANI_API_KEY')
stt_url = os.getenv('GNANI_STT_URL')
model = os.getenv('GNANI_MODEL')

# Generate 16kHz WAV using PowerShell script file to avoid escaping issues
ps_script = """
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$synth.SetOutputToWaveFile('test_speech.wav', $fmt)
$synth.Speak('Hello doctor, I have been experiencing severe headache, nausea, and fever for two days.')
$synth.Dispose()
"""

with open('gen_wav.ps1', 'w') as f:
    f.write(ps_script)

subprocess.run(['powershell', '-ExecutionPolicy', 'Bypass', '-File', 'gen_wav.ps1'], check=True)

if not os.path.exists('test_speech.wav'):
    raise Exception('test_speech.wav not created')

print('Generated test_speech.wav of size:', os.path.getsize('test_speech.wav'))

# Read raw PCM from WAV (skip 44 byte header)
with open('test_speech.wav', 'rb') as f:
    wav_header = f.read(44)
    pcm_data = f.read()

print(f'PCM data size: {len(pcm_data)} bytes ({len(pcm_data)/32000:.2f} seconds)')

async def stream_to_gnani():
    headers = {
        'x-api-key-id': api_key,
        'language_code': 'en-IN',
        'model': model
    }
    print(f'Connecting to {stt_url}...')
    async with websockets.connect(stt_url, additional_headers=headers) as ws:
        init = await ws.recv()
        print('Initial handshake message:', init)

        chunk_size = 1024 # 512 samples = 32ms
        offset = 0

        async def send_audio():
            nonlocal offset
            while offset < len(pcm_data):
                chunk = pcm_data[offset:offset+chunk_size]
                offset += chunk_size
                await ws.send(chunk)
                await asyncio.sleep(0.032)
            print('Finished streaming speech audio. Sending trailing silence for VAD...')
            silence = b'\\x00' * 1024
            for _ in range(40):
                await ws.send(silence)
                await asyncio.sleep(0.032)
            print('Trailing silence sent.')

        sender = asyncio.create_task(send_audio())

        while True:
            try:
                resp = await asyncio.wait_for(ws.recv(), timeout=4.0)
                data = json.loads(resp)
                print('Gnani Event:', json.dumps(data, indent=2))
                if data.get('type') == 'transcript' and data.get('text'):
                    print('\n>>> RECOGNIZED TRANSCRIPT:', data['text'], '<<<\n')
            except asyncio.TimeoutError:
                print('Timeout waiting for more Gnani messages.')
                break

        await sender

asyncio.run(stream_to_gnani())

