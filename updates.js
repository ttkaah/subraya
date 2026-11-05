// Tablón de novedades. Se añade una entrada NUEVA ARRIBA cada vez que se actualiza la web.
// date: 'AAAA-MM-DD'. Si no se conoce la fecha exacta, usa when: 'texto' y date: null.
window.SB_VERSION = 'v20';
window.SB_UPDATES = [
  {
    v: 'v20', date: '2026-11-05',
    title: 'Reintentos automáticos cuando Google está saturado',
    items: [
      'Si Gemini responde «alta demanda» (error del lado de Google, no de tu clave), la web reintenta sola hasta dos veces antes de avisarte.',
      'Si sigue saturado, el mensaje ahora lo explica con claridad y te sugiere esperar un minuto o probar otro modelo en Ajustes.'
    ]
  },
  {
    v: 'v19', date: '2026-11-05',
    title: 'Temarios guardados, pestañas nuevas y rangos en la clasificación',
    items: [
      'Nuevo panel «Temario» a la izquierda: todos tus temas guardados, con su nivel, su rango, su ELO y su barra de progreso. Pulsa uno para volver a él justo donde lo dejaste.',
      'Cada temario tiene sus botones para añadirle archivos, renombrarlo o borrarlo.',
      'Cabecera nueva: el logo a la izquierda, Ajustes a la derecha y dos pestañas: «Tutorial API» y «Novedades».',
      'Tutorial paso a paso para conseguir tu clave gratuita en Google AI Studio.',
      'Esta página de novedades, con un punto rojo cuando hay cambios que todavía no has visto.',
      'La clasificación muestra el rango (de Hierro a Radiante) junto al nombre de cada jugador. Cada jugador aparece con su rango real cuando vuelve a responder preguntas. Para que funcione hay que volver a publicar las reglas de Firestore.',
      'Al elegir un temario ya no se lanza la práctica sola: pulsa «Empezar práctica» cuando quieras.',
      'Arreglo: los elementos ocultos ya no se muestran por error.'
    ]
  },
  {
    v: 'v1 – v18', date: null, when: 'Antes del 5 de noviembre de 2026',
    title: 'Todo lo construido hasta ahora',
    items: [
      'Práctica con preguntas tipo test (4 opciones, verdadero/falso y rellenar huecos) generadas a partir de tus apuntes con la IA de Google.',
      'Subida de PDF (también escaneados), Word, PowerPoint, TXT y MD; se pueden combinar varios archivos en un temario.',
      'Niveles: 300 niveles en 60 etapas, con color propio y animaciones. Subes con los aciertos y bajas con fallos seguidos.',
      'Repaso automático de las preguntas que fallas.',
      'Exámenes: eliges el número de preguntas, no ves las soluciones hasta entregar y recibes tu nota sobre 10 con la corrección.',
      'ELO y rangos (Hierro, Bronce, Plata, Oro, Platino, Diamante, Ascendente, Inmortal y Radiante), por temario y en total.',
      'Clasificación con perfiles de nombre y contraseña, foto o avatar, y tablas semanal, total y de precisión.',
      'Objetivo diario, racha de días, atajos de teclado, sonidos opcionales, exportar e importar tu progreso y modo claro/oscuro.'
    ]
  }
];
