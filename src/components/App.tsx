import React, { useState, useEffect, useRef } from 'react';
import Pill from './Pill';
import { startRecording, stopRecording } from '../lib/audio';

// Placeholder transcription text (would be replaced with actual API call result)
// const PLACEHOLDER_TEXT = "This is a sample transcription. It will be inserted at your cursor position.";

const App: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Handle toggle dictation from shortcut
  useEffect(() => {
    if (!window.electron) return;

    const handleToggleDictation = () => {
      console.log('Toggle dictation shortcut pressed, current state:', 
        isListening ? 'listening' : 'not listening',
        isProcessing ? 'processing' : 'not processing');
      
      if (isListening) {
        handleStopDictation();
      } else if (!isProcessing) {
        handleStartDictation();
      } else {
        setErrorMessage('Still processing previous dictation');
      }
    };

    // Register for hotkey events and store the cleanup function
    const cleanup = window.electron.toggleDictation(handleToggleDictation);

    // Return the cleanup function to remove the event listener when the component unmounts
    // or when the dependencies change
    return cleanup;
  }, [isListening, isProcessing]);

  // Clear error message after a delay
  useEffect(() => {
    if (!errorMessage) return;
    
    const timer = setTimeout(() => setErrorMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      console.log('App component unmounting, cleaning up resources');
      cleanupRecording();
    };
  }, []);

  // Helper function to clean up recording resources
  const cleanupRecording = () => {
    if (!mediaRecorderRef.current) return;
    
    console.log('Cleaning up MediaRecorder');
    
    try {
      // Stop the recorder if it's still recording
      if (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop all tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
    } catch (e) {
      console.error('Error cleaning up MediaRecorder:', e);
    }
    
    // Clear the reference
    mediaRecorderRef.current = null;
  };

  const handleStartDictation = async () => {
    try {
      console.log('=== DICTATION START PROCESS ===');
      
      // First, ensure any previous recording is cleaned up
      cleanupRecording();
      
      // Update UI state
      setIsListening(true);
      setErrorMessage(null);
      
      // Start recording
      console.log('Starting new recording...');
      mediaRecorderRef.current = await startRecording();
      
      // Notify main process
      if (window.electron) {
        await window.electron.startRecording();
      }
      
      console.log('=== DICTATION START COMPLETE ===');
    } catch (error) {
      console.error('=== DICTATION START FAILED ===', error);
      setErrorMessage('Could not access microphone. Please check permissions.');
      setIsListening(false);
      cleanupRecording();
    }
  };

  const handleStopDictation = async () => {
    if (!mediaRecorderRef.current) {
      console.error('No active recording found');
      setIsListening(false);
      return;
    }
    
    console.log('=== DICTATION STOP PROCESS ===');
    
    // Update UI state
    setIsListening(false);
    setIsProcessing(true);
    
    try {
      // Stop recording and get audio data
      console.log('Stopping recording...');
      const audioBlob = await stopRecording(mediaRecorderRef.current);
      
      // Clear the reference immediately
      mediaRecorderRef.current = null;
      
      // Notify main process
      if (window.electron) {
        await window.electron.stopRecording();
      }
      
      // Skip transcription if blob is empty
      if (audioBlob.size === 0) {
        console.log('Audio blob is empty, skipping transcription');
        setIsProcessing(false);
        return;
      }
      
      // Convert audio for transcription
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Transcribe audio
      if (window.electron) {
        console.log('Sending audio for transcription...');
        const transcriptionResult = await window.electron.transcribeAudio(uint8Array);
        
        if (!transcriptionResult.success) {
          throw new Error(transcriptionResult.error || 'Transcription failed');
        }
        
        // Insert text at cursor
        console.log('Inserting transcribed text at cursor');
        const insertResult = await window.electron.insertTextAtCursor(transcriptionResult.text || '');
        
        if (!insertResult.success && insertResult.error) {
          setErrorMessage(insertResult.error);
        }
      } else {
        throw new Error('Electron API not available');
      }
      
      console.log('=== DICTATION PROCESS COMPLETE ===');
    } catch (error) {
      console.error('=== DICTATION PROCESS FAILED ===', error);
      setErrorMessage('An error occurred while processing your dictation.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container w-full h-screen bg-transparent overflow-hidden relative">
      <Pill 
        isListening={isListening}
        isProcessing={isProcessing}
        onStartDictation={handleStartDictation}
        onStopDictation={handleStopDictation}
      />
      
      {/* Error Toast/Notification */}
      {errorMessage && (
        <div className="error-toast absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50 text-sm">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default App; 