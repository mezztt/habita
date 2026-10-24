// Íconos del menú y de la barra superior: trazo simple, todos del mismo tamaño y grosor,
// heredan el color del texto (se ven igual en claro y oscuro).
import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.2 8.2 7.8 5.6 7.8-5.6" /></>,
  home: <><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></>,
  cash: <><rect x="3" y="6.5" width="18" height="11" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 10v4M17.5 10v4" /></>,
  invoice: <><path d="M6 3.5h12v17l-2.5-1.6L13 20.5l-2.5-1.6L8 20.5 6 19.2z" /><path d="M9 8h6M9 12h6" /></>,
  systems: <><rect x="4" y="4" width="7" height="7" rx="1.8" /><rect x="13" y="4" width="7" height="7" rx="1.8" /><rect x="4" y="13" width="7" height="7" rx="1.8" /><rect x="13" y="13" width="7" height="7" rx="1.8" /></>,
  users: <><circle cx="12" cy="8.2" r="3.6" /><path d="M5 20.5c.5-3.9 3.2-6 7-6s6.5 2.1 7 6" /></>,
  usersRound: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c.5-3.6 3-5.5 6.5-5.5s6 1.9 6.5 5.5" /><path d="M3.5 11.5a2.6 2.6 0 0 1 3.4-2.4M20.5 11.5a2.6 2.6 0 0 0-3.4-2.4" /></>,
  contact: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9.5" cy="10.5" r="2.2" /><path d="M5.8 16c.4-1.8 1.7-2.8 3.7-2.8s3.3 1 3.7 2.8" /><path d="M15 9.5h3M15 13h3" /></>,
  chart: <><path d="M4 20.5h16" /><path d="M7 20.5v-7M12 20.5V5M17 20.5v-10" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  calendarCheck: <><rect x="4" y="5.5" width="16" height="15" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /><path d="m9 15 2.2 2.2L15.5 13" /></>,
  list: <><path d="M8.5 7h11M8.5 12h11M8.5 17h11" /><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" /></>,
  edit: <><path d="M4.5 19.5l1-4L16 5a1.8 1.8 0 0 1 2.6 0l.4.4a1.8 1.8 0 0 1 0 2.6L8.5 18.5z" /><path d="M14.5 6.5l3 3" /></>,
  upload: <><path d="M12 15.5v-11" /><path d="m7.5 9 4.5-4.5L16.5 9" /><path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" /></>,
  transfer: <><path d="M4 8.5h15" /><path d="m15.5 5 3.5 3.5-3.5 3.5" /><path d="M20 15.5H5" /><path d="m8.5 12-3.5 3.5L8.5 19" /></>,
  sun: <><circle cx="12" cy="12" r="3.6" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" /></>,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  bell: <><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  logout: <><path d="M14 4.5h4.5v15H14" /><path d="M4 12h10" /><path d="m10.5 8.5 3.5 3.5-3.5 3.5" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8" /><path d="M12 16.8h.01" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  // Habita: un ícono por módulo (mismo trazo que el resto)
  key: <><circle cx="8" cy="15" r="3.5" /><path d="M10.5 12.5 19 4" /><path d="m16 7 2.2 2.2M13.6 9.4l1.8 1.8" /></>,
  contract: <><path d="M6 3.5h8l4 4v13H6z" /><path d="M14 3.5v4h4" /><path d="M9 16.5c1-1.8 1.6-1.8 2 0s1.2 1.4 2.4-.4" /><path d="M9 11.5h3" /></>,
  receipt: <><path d="M6 3.5h12v17l-2.5-1.6L13 20.5l-2.5-1.6L8 20.5 6 19.2z" /><path d="M9 8h6M9 12h6" /></>,
  calculator: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M8.5 7.5h7" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" /></>,
  shield: <><path d="M12 3.5 19 6v5.5c0 4.2-2.8 7.4-7 9-4.2-1.6-7-4.8-7-9V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  building: <><rect x="5" y="3.5" width="9" height="17" rx="1.5" /><path d="M14 9.5h4a1 1 0 0 1 1 1v10h-5" /><path d="M8.5 7.5h2M8.5 11h2M8.5 14.5h2" /></>,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3.8 17a2 2 0 0 0 2.8 2.8l5.6-5.5a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.3-.6-.6-2.3z" />,
  camera: <><path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10.5H4z" /><circle cx="12" cy="13.5" r="3.2" /></>,
  folder: <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" />,
  scale: <><path d="M12 4v16M7 20.5h10M5 8h14" /><path d="m5 8-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  phone: <path d="M6.5 4h3l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5L16 13l4 1.5v3a2 2 0 0 1-2 2A14 14 0 0 1 4.5 6a2 2 0 0 1 2-2z" />,
};

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg className="ui-icon" data-contrast-ignore width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] || PATHS.home}
    </svg>
  );
}
