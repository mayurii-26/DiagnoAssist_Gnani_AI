import asyncio
import os
import json
import websockets
from dotenv import load_dotenv

load_dotenv('backend/.env')
api_key = os.getenv('GNANI_API_KEY')
stt_url = os.getenv('GNANI_STT_URL')
model = os.getenv('GNANI_MODEL')

with open('test_speech.wav', 'rb') as f:
    f.seek(44)
    pcm_data = f.read()

print(f'PCM data: {len(pcm_data)} bytes ({len(pcm_data)/32000:.2f}s)')

async def stream_to_gnani():
    headers = {
        'x-api-key-id': api_key,
        'language_code': 'en-IN',
        'model': model
    }
    async with websockets.connect(stt_url, additional_headers=headers) as ws:
        init = await ws.recv()
        print('Initial handshake:', init)

        async def send_audio():
            chunk_size = 1024 # 512 samples = 32ms
            for offset in range(0, len(pcm_data), chunk_size):
                await ws.send(pcm_data[offset:offset+chunk_size])
                await asyncio.sleep(0.032)
            print('Speech sent. Sending 1.5s trailing silence for VAD speech_end...')
            silence = b'\x00' * 1024
            for _ in range(50):
                await ws.send(silence)
                await asyncio.sleep(0.032)
            print('All audio & silence sent.')

        sender_task = asyncio.create_task(send_audio())

        while True:
            try:
                resp = await asyncio.wait_for(ws.recv(), timeout=10.0)
                data = json.loads(resp)
                print('Gnani Event:', json.dumps(data))
                if data.get('type') == 'transcript':
                    print('\n========================================')
                    print('SUCCESS! Transcript received:', data.get('text'))
                    print('========================================\n')
            except asyncio.TimeoutError:
                print('No more events within 10s.')
                break

        await sender_task

asyncio.run(stream_to_gnani())

