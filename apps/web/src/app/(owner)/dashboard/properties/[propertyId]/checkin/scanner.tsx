'use client';

import jsQR from 'jsqr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import type { CheckinResult } from '@/lib/types';
import { redeemPassAction } from './actions';

type Phase = 'idle' | 'starting' | 'scanning' | 'working' | 'done';

/**
 * The desk-side half of check-in: point the camera at the tenant's pass.
 *
 * Two ways in, because in a real building only one of them will work on any
 * given day. The camera is faster when it cooperates; the typed code is what
 * gets used when the tenant's screen is cracked, the light is bad, or the
 * phone is on 2% and dying.
 *
 * Decoding happens here rather than on the server — sending video frames up a
 * hostel's connection to read six digits would be absurd.
 */
export function CheckinScanner({ propertyId }: { propertyId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [code, setCode] = useState('');

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // A camera left running is a light on the front of someone's phone and a
  // flat battery by lunchtime.
  useEffect(() => stopCamera, [stopCamera]);

  const submit = useCallback(
    async (payload: { token?: string; shortCode?: string }) => {
      setPhase('working');
      setError(null);
      const outcome = await redeemPassAction(propertyId, payload);
      if (outcome.error) {
        setError(outcome.error);
        setPhase('idle');
        return;
      }
      setResult(outcome.result ?? null);
      setPhase('done');
      stopCamera();
    },
    [propertyId, stopCamera],
  );

  const startCamera = useCallback(async () => {
    setError(null);
    setCameraNote(null);
    setPhase('starting');

    // Browsers only hand over a camera on HTTPS or localhost. On a phone
    // pointed at a dev machine's IP address this always fails, so say why
    // rather than leaving someone tapping a dead button.
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraNote(
        'This browser will not open the camera here. Cameras need a secure (https) address — type the code instead.',
      );
      setPhase('idle');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setPhase('scanning');
      frameRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraNote('Could not open the camera. Type the six-digit code instead.');
      setPhase('idle');
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(image.data, image.width, image.height, {
        inversionAttempts: 'dontInvert',
      });

      if (found?.data) {
        void submit({ token: found.data });
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    }
  }, [submit]);

  if (phase === 'done' && result) {
    const paid = result.settlementStatus === 'RELEASED';
    return (
      <Card>
        <p className="eyebrow mb-2">Checked in</p>
        <h2 className="display text-2xl">{result.tenantName}</h2>
        <p className="mt-1 text-[var(--text-muted)]">
          Room {result.roomCode}, bed {result.bedCode}
        </p>

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          {paid ? (
            <p className="text-sm text-[var(--ok)]">
              Their payment has been released to you.
            </p>
          ) : (
            <Alert tone="info">
              {result.settlementPending ??
                'The check-in is recorded. Paying you out is being retried.'}
            </Alert>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          fullWidth
          className="mt-5"
          onClick={() => {
            setResult(null);
            setCode('');
            setPhase('idle');
          }}
        >
          Check someone else in
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {cameraNote ? (
        <div className="mb-4">
          <Alert tone="info">{cameraNote}</Alert>
        </div>
      ) : null}

      <div className="mb-5">
        <div
          className={
            'relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--bg-deep)] ' +
            (phase === 'scanning' ? 'block' : 'hidden')
          }
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/70"
          />
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {phase !== 'scanning' ? (
          <Button
            type="button"
            fullWidth
            disabled={phase === 'starting' || phase === 'working'}
            onClick={() => void startCamera()}
          >
            {phase === 'starting' ? 'Opening camera…' : 'Scan their pass'}
          </Button>
        ) : (
          <Button type="button" variant="secondary" fullWidth className="mt-3" onClick={() => {
            stopCamera();
            setPhase('idle');
          }}>
            Stop the camera
          </Button>
        )}
      </div>

      <div className="border-t border-[var(--border)] pt-5">
        <Field
          label="Or type the six digits under their QR"
          htmlFor="checkin-code"
          hint="For a cracked screen, or a camera that will not focus"
        >
          <Input
            id="checkin-code"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="048213"
            className="figure text-lg tracking-[0.3em]"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </Field>
        <Button
          type="button"
          fullWidth
          className="mt-3"
          disabled={code.length !== 6 || phase === 'working'}
          onClick={() => void submit({ shortCode: code })}
        >
          {phase === 'working' ? 'Checking…' : 'Check in'}
        </Button>
      </div>
    </Card>
  );
}
