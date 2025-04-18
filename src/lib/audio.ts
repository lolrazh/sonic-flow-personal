/**
 * Audio recording and processing utilities for Sonic Flow
 */

/**
 * Records audio from the user's microphone
 * @returns Promise that resolves with the MediaRecorder instance
 */
export async function startRecording(): Promise<MediaRecorder> {
  console.log('=== AUDIO RECORDING START ===');
  console.log('Requesting microphone access...');
  
  // Request microphone access
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    } 
  });
  
  console.log('Microphone access granted');
  console.log('Audio tracks:', stream.getAudioTracks().length);
  
  // Create a MediaRecorder instance with options for better audio quality
  console.log('Creating MediaRecorder with audio/webm MIME type');
  const options = { mimeType: 'audio/webm' };
  
  try {
    const mediaRecorder = new MediaRecorder(stream, options);
    console.log('MediaRecorder created successfully');
    console.log('MediaRecorder state:', mediaRecorder.state);
    
    // Start recording
    console.log('Starting MediaRecorder...');
    mediaRecorder.start();
    console.log('MediaRecorder started, state:', mediaRecorder.state);
    console.log('=== AUDIO RECORDING STARTED ===');
    
    return mediaRecorder;
  } catch (error) {
    console.error('=== AUDIO RECORDING FAILED ===');
    console.error('Error creating MediaRecorder:', error);
    // Make sure to clean up the stream if MediaRecorder creation fails
    stream.getTracks().forEach(track => track.stop());
    throw error;
  }
}

/**
 * Stops recording and returns the audio data
 * @param mediaRecorder The MediaRecorder instance to stop
 * @returns Promise that resolves with the recorded audio as a Blob
 */
export function stopRecording(mediaRecorder: MediaRecorder): Promise<Blob> {
  console.log('=== AUDIO RECORDING STOP ===');
  console.log('MediaRecorder current state:', mediaRecorder.state);
  
  // If the recorder isn't recording, return an empty blob
  if (mediaRecorder.state !== 'recording' && mediaRecorder.state !== 'paused') {
    console.log('MediaRecorder is not recording, returning empty blob');
    return Promise.resolve(new Blob([], { type: 'audio/webm' }));
  }
  
  return new Promise((resolve) => {
    // Array to store audio chunks
    const audioChunks: BlobPart[] = [];
    
    // Function to handle data available event
    const handleDataAvailable = (event: BlobEvent) => {
      console.log('Received dataavailable event, data size:', event.data.size, 'bytes');
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    // Function to handle stop event
    const handleStop = () => {
      console.log('MediaRecorder stopped event fired');
      
      // Create a blob with the appropriate MIME type
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log('Audio blob created, size:', audioBlob.size, 'bytes');
      
      // Stop all tracks in the stream
      console.log('Stopping all audio tracks...');
      mediaRecorder.stream.getTracks().forEach(track => {
        console.log(`Stopping track: ${track.kind}`);
        track.stop();
      });
      
      // Remove event listeners to prevent memory leaks
      mediaRecorder.removeEventListener('dataavailable', handleDataAvailable);
      mediaRecorder.removeEventListener('stop', handleStop);
      
      console.log('=== AUDIO RECORDING COMPLETE ===');
      resolve(audioBlob);
    };
    
    // Add event listeners
    mediaRecorder.addEventListener('dataavailable', handleDataAvailable);
    mediaRecorder.addEventListener('stop', handleStop);
    
    // Request data from the recorder
    try {
      mediaRecorder.requestData();
    } catch (e) {
      console.warn('Error requesting data from MediaRecorder:', e);
    }
    
    // Stop the recorder
    mediaRecorder.stop();
    console.log('Stop command sent to MediaRecorder');
  });
}

/**
 * Converts an audio Blob to a Buffer for sending to Groq API
 * @param audioBlob The audio blob to convert
 * @returns Promise that resolves with the audio as a Buffer
 */
export async function audioToBuffer(audioBlob: Blob): Promise<Buffer> {
  console.log('=== AUDIO CONVERSION START ===');
  console.log('Converting audio blob to array buffer, blob size:', audioBlob.size, 'bytes');
  const arrayBuffer = await audioBlob.arrayBuffer();
  console.log('Array buffer created, size:', arrayBuffer.byteLength, 'bytes');
  
  console.log('Converting array buffer to Node.js Buffer');
  const buffer = Buffer.from(arrayBuffer);
  console.log('Buffer created, size:', buffer.length, 'bytes');
  console.log('=== AUDIO CONVERSION COMPLETE ===');
  
  return buffer;
} 