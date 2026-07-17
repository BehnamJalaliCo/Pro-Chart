/**
 * کلاینت‌های سبکِ WebRTC برای لایو ترید.
 *
 *  - whepPlay: دریافت و پخشِ یک استریم از MediaMTX (WHEP) روی یک <video>.
 *  - whipPublish: انتشارِ یک MediaStream (وبکم/میکروفون) به MediaMTX (WHIP).
 *
 * هر دو از پروتکلِ استانداردِ WHEP/WHIP استفاده می‌کنند: SDP offer با POST
 * ارسال و SDP answer دریافت می‌شود.
 */

/**
 * پخشِ یک مسیر با WHEP.
 * @returns {{ pc: RTCPeerConnection, close: () => void }}
 */
export async function whepPlay({ url, videoEl, iceServers = [], onState }) {
  const pc = new RTCPeerConnection({ iceServers });

  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });

  const remote = new MediaStream();
  pc.ontrack = (ev) => {
    remote.addTrack(ev.track);
    if (videoEl && videoEl.srcObject !== remote) {
      videoEl.srcObject = remote;
    }
  };
  pc.onconnectionstatechange = () => onState && onState(pc.connectionState);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitIceGathering(pc);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: pc.localDescription.sdp,
  });
  if (!res.ok) {
    pc.close();
    throw new Error(`WHEP ${res.status}`);
  }
  const answer = await res.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answer });

  return { pc, close: () => pc.close() };
}

/**
 * انتشارِ یک MediaStream با WHIP (احرازِ Basic با کاربر/رمزِ انتشار).
 * @returns {{ pc: RTCPeerConnection, close: () => void }}
 */
export async function whipPublish({ url, stream, iceServers = [], username, password, onState }) {
  const pc = new RTCPeerConnection({ iceServers });
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  pc.onconnectionstatechange = () => onState && onState(pc.connectionState);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitIceGathering(pc);

  const headers = { 'Content-Type': 'application/sdp' };
  if (username) {
    headers.Authorization = 'Basic ' + btoa(`${username}:${password || ''}`);
  }
  const res = await fetch(url, { method: 'POST', headers, body: pc.localDescription.sdp });
  if (!res.ok) {
    pc.close();
    throw new Error(`WHIP ${res.status}`);
  }
  const answer = await res.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answer });

  return { pc, close: () => pc.close() };
}

/** صبر تا پایانِ جمع‌آوریِ ICE (یا تایم‌اوتِ کوتاه برای trickle محدود). */
function waitIceGathering(pc, timeoutMs = 1500) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(done, timeoutMs);
  });
}
