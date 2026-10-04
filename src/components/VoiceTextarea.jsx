import { useEffect, useRef, useState } from 'react';

// Nunca inicia reconocimiento remoto: exige que el navegador confirme el paquete local.
export default function VoiceTextarea({ name, defaultValue = '', rows = 4, placeholder = '', required = false }) {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  async function dictate() {
    if (listening) { recognitionRef.current?.stop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition?.available || !('processLocally' in Recognition.prototype)) {
      setStatus('Este navegador no ofrece dictado local. Podés escribir o usar el dictado del sistema.');
      return;
    }
    try {
      let availability = await Recognition.available({ langs: ['es-AR'], processLocally: true });
      if (availability === 'downloadable' && Recognition.install) {
        setStatus('Instalando el paquete local de español…');
        await Recognition.install({ langs: ['es-AR'], processLocally: true });
        availability = await Recognition.available({ langs: ['es-AR'], processLocally: true });
      }
      if (availability !== 'available') {
        setStatus('El reconocimiento local en español no está disponible en este navegador.');
        return;
      }
      const recognition = new Recognition();
      recognition.lang = 'es-AR';
      recognition.processLocally = true;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = event => {
        const transcript = Array.from(event.results).map(result => result[0]?.transcript || '').join(' ').trim();
        if (transcript) setValue(previous => `${previous}${previous.trim() ? ' ' : ''}${transcript}`);
        setStatus('Revisá el texto reconocido antes de guardar.');
      };
      recognition.onerror = () => { setStatus('No se pudo reconocer el audio localmente. Escribí la novedad.'); setListening(false); };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      setStatus('Escuchando en este dispositivo…');
    } catch {
      setListening(false);
      setStatus('El dictado local no está disponible. Escribí la novedad.');
    }
  }

  return <div className="voice-field">
    <textarea name={name} rows={rows} placeholder={placeholder} required={required} value={value} onChange={event => setValue(event.target.value)} />
    <button type="button" onClick={dictate} aria-label={listening ? 'Detener dictado' : 'Dictar descripción'}>{listening ? 'Detener' : '🎙 Dictar'}</button>
    {status && <small role="status">{status}</small>}
  </div>;
}
