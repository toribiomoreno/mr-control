export default function MaterialIcon({ className = '', name = 'box' }) {
  const classes = ['material-icon', className].filter(Boolean).join(' ');

  return (
    <svg aria-hidden="true" className={classes} focusable="false" viewBox="0 0 24 24">
      {name === 'locomotive' && (
        <>
          <path d="M6 7h12l1 8H5l1-8Z" />
          <path d="M8 7V4h8v3" />
          <path d="M8 11h8" />
          <path d="M8 18h8" />
          <path d="M7 15h10" />
          <path d="M8 21h2" />
          <path d="M14 21h2" />
        </>
      )}
      {name === 'coach' && (
        <>
          <path d="M4 8h16v8H4V8Z" />
          <path d="M7 11h2" />
          <path d="M12 11h2" />
          <path d="M17 11h1" />
          <path d="M7 19h2" />
          <path d="M15 19h2" />
        </>
      )}
      {name === 'areas' && (
        <>
          <path d="M12 4v16" />
          <path d="M4 8h16" />
          <path d="M4 16h16" />
          <path d="M6 6h4v4H6V6Z" />
          <path d="M14 14h4v4h-4v-4Z" />
        </>
      )}
      {name === 'reports' && (
        <>
          <path d="M5 19V9" />
          <path d="M12 19V5" />
          <path d="M19 19v-7" />
          <path d="M4 19h16" />
        </>
      )}
      {name === 'calendar' && (
        <>
          <path d="M5 5h14v15H5V5Z" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M5 10h14" />
        </>
      )}
      {name === 'clock' && (
        <>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path d="M12 7v6l4 2" />
        </>
      )}
      {name === 'flag' && (
        <>
          <path d="M6 21V4" />
          <path d="M6 5c4-2 6 2 12 0v9c-6 2-8-2-12 0" />
        </>
      )}
      {name === 'shield' && (
        <>
          <path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </>
      )}
      {name === 'tools' && (
        <>
          <path d="m14.5 6 3.5-3.5 3.5 3.5-3.5 3.5" />
          <path d="m2.5 21.5 8.5-8.5" />
          <path d="m4 4 5 5" />
          <path d="m3 8 3-3" />
          <path d="m15 15 5 5" />
          <path d="m17 21 4-4" />
        </>
      )}
      {name === 'document' && (
        <>
          <path d="M7 3h7l4 4v14H7V3Z" />
          <path d="M14 3v5h5" />
          <path d="M10 13h5" />
          <path d="M10 17h5" />
        </>
      )}
      {name === 'trend' && (
        <>
          <path d="M4 18 9 13l4 3 7-9" />
          <path d="M15 7h5v5" />
          <path d="M4 21h16" />
        </>
      )}
      {name === 'archive' && (
        <>
          <path d="M4 5h16v4H4V5Z" />
          <path d="M6 9h12v11H6V9Z" />
          <path d="M10 13h4" />
        </>
      )}
      {name === 'search' && (
        <>
          <path d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z" />
          <path d="m16 16 5 5" />
        </>
      )}
      {name === 'clipboard' && (
        <>
          <path d="M8 5h8" />
          <path d="M9 3h6v4H9V3Z" />
          <path d="M6 5H5v16h14V5h-1" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </>
      )}
      {name === 'warning' && (
        <>
          <path d="M12 4 21 20H3L12 4Z" />
          <path d="M12 10v4" />
          <path d="M12 17h.01" />
        </>
      )}
      {name === 'alert' && (
        <>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path d="M12 7v6" />
          <path d="M12 16h.01" />
        </>
      )}
      {name === 'target' && (
        <>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
          <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
          <path d="M17 7 21 3" />
        </>
      )}
      {name === 'download' && (
        <>
          <path d="M12 4v10" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 19h14" />
        </>
      )}
      {name === 'plus' && (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      )}
      {name === 'chevron-right' && <path d="m9 5 7 7-7 7" />}
      {name === 'arrow-right' && (
        <>
          <path d="M4 12h16" />
          <path d="m14 6 6 6-6 6" />
        </>
      )}
      {name === 'box' && (
        <>
          <path d="M4 7h16v14H4V7Z" />
          <path d="M8 7V4h8v3" />
        </>
      )}
    </svg>
  );
}
