import { useState } from 'react';

import { isValidTimeValue } from './timeUtils.js';

function normalizeInitialTime(value) {
  const raw = String(value || '').slice(0, 5);
  return isValidTimeValue(raw) ? raw : '00:00';
}

function cleanTimeInput(value) {
  return String(value || '').replace(/[^0-9:]/g, '').slice(0, 5);
}

export default function TimeSelect({ defaultValue, label = 'Hora', name = 'hora' }) {
  const [value, setValue] = useState(normalizeInitialTime(defaultValue));

  return (
    <label>
      {label}
      <input
        inputMode="numeric"
        maxLength="5"
        name={name}
        onChange={(event) => setValue(cleanTimeInput(event.target.value))}
        pattern="^([01]\d|2[0-3]):[0-5]\d$"
        placeholder="HH:mm"
        required
        title="Use formato HH:mm, por ejemplo 19:44."
        value={value}
      />
    </label>
  );
}
