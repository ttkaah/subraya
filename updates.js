// Tablón de novedades. Se añade una entrada NUEVA ARRIBA cada vez que se actualiza la web.
// date: 'AAAA-MM-DD'. Si no se conoce la fecha exacta, usa when: 'texto' y date: null.
window.SB_VERSION = 'v23';
window.SB_UPDATES = [
  {
    v: 'v23', date: '2026-11-05',
    title: 'Tus temarios y tu progreso te siguen a cualquier dispositivo',
    items: [
      'Nueva casilla «Sincronizar mis temarios entre dispositivos» en tu perfil. Al activarla, tus apuntes, nivel, ELO y rango de cada temario se guardan en tu cuenta. Al entrar desde otro dispositivo aparecen igual que los dejaste.',
      'En un dispositivo nuevo, si ya habías activado la sincronización en otro, se activa sola al iniciar sesión.',
      'Si cambias algo en dos dispositivos, gana siempre el cambio más reciente de cada temario. Los borrados también se sincronizan.',
      'Arreglo: el ELO de la clasificación ya no depende del dispositivo. Antes, responder desde uno donde tenías menos temarios podía bajar tu rango en la tabla. Ahora se acumula por incrementos.',
      'La clasificación y la sincronización guardan tus datos cada 30 segundos (antes 15) para ahorrar cuota gratuita.',
      'Privacidad: al sincronizar, tus apuntes se guardan en Firebase. Solo tú puedes leerlos desde la web, pero quien administra el proyecto podría verlos en su consola.',
      'Hay que volver a publicar las reglas de Firestore y subir sync.js.'
    ]
  },
  {
    v: 'v22', date: '2026-11-05',
    title: 'Cambiar el nombre del perfil sin borrarlo',
    items: [
      'Nuevo botón «Cambiar nombre» en tu perfil: cambia el nombre que ven los demás en la clasificación, conservando tus puntos, tu foto y tu rango.',
      'Los nombres visibles no se pueden repetir, ni siquiera con otras mayúsculas.',
      'Para entrar sigues usando tu usuario original, el de cuando creaste el perfil. Tu perfil te recuerda cuál es.',
      'Hay que volver a publicar las reglas de Firestore (firestore.rules).'
    ]
  },
  {
    v: 'v21', date: '2026-11-05',
    title: 'Modelo de reserva y lista de modelos disponibles',
    items: [
      'Ajustes tiene ahora un «Modelo de reserva»: si el principal está saturado incluso tras los reintentos, la web prueba sola con el de reserva.',
      'Nuevo botón «Ver modelos disponibles»: muestra los modelos que tu clave puede usar para que elijas uno como principal y otro como reserva, sin adivinar nombres.'
    ]
  },
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
