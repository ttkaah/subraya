// Tablón de novedades. Se añade una entrada NUEVA ARRIBA cada vez que se actualiza la web.
// date: 'AAAA-MM-DD' (la fecha REAL de la actualización). approx: true si es aproximada.
window.SB_VERSION = 'v25';
window.SB_UPDATES = [
  {
    v: 'v25', date: '2026-11-10',
    title: 'Sugerencias, favicon y pantalla de carga',
    items: [
      'Nueva pestaña «Sugerencias»: envía una idea, una mejora o un fallo con tu perfil y consulta aquí mismo su estado (recibida, vista, en marcha, hecha) y la respuesta si la hay.',
      'La web ya tiene icono propio: sale en la pestaña del navegador, en los marcadores y al añadirla a la pantalla de inicio del móvil.',
      'Pantalla de carga con el logo mientras se preparan tus temarios, que se quita sola en cuanto todo está listo.',
      'Hay que volver a publicar las reglas de Firestore y subir los archivos nuevos (mira FIREBASE.md).'
    ]
  },
  {
    v: 'v24', date: '2026-11-09',
    title: 'Fechas corregidas en Novedades',
    items: [
      'Cada anuncio muestra ahora la fecha en que se hizo de verdad. Antes varias entradas decían «5 de noviembre» por un error al apuntarlas: la v22 es del 6 y la v23 del 9 de noviembre.',
      'Al lado de la fecha aparece cuánto hace («hoy», «ayer», «hace 4 días»), que se actualiza solo cada vez que abres la página.',
      'Las primeras versiones, que estaban en una sola entrada de «antes del 5 de noviembre», se han separado en tres fases con su fecha aproximada.'
    ]
  },
  {
    v: 'v23', date: '2026-11-09',
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
    v: 'v22', date: '2026-11-06',
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
    v: 'Fase 3', date: '2026-11-04', approx: true,
    title: 'ELO, rangos, 300 niveles y perfiles',
    items: [
      'ELO por temario y en total, con 9 rangos (Hierro, Bronce, Plata, Oro, Platino, Diamante, Ascendente, Inmortal y Radiante) e insignias propias.',
      'Niveles ampliados hasta 300 (60 etapas de 5 niveles), con color propio y animaciones; el ritmo se hace más gradual en los niveles altos.',
      'Perfiles con nombre de usuario y contraseña, sin correo, con foto o avatar de emoji.',
      'Clasificación con tablas semanal, total y de precisión, y aviso de errores en pantalla.'
    ]
  },
  {
    v: 'Fase 2', date: '2026-11-03', approx: true,
    title: 'Práctica con IA gratuita, exámenes y primera clasificación',
    items: [
      'Cambio a la IA gratuita de Google (Gemini) con tu propia clave, que se guarda solo en tu navegador.',
      'Preguntas tipo test, verdadero/falso y rellenar huecos; la siguiente pregunta se prepara mientras contestas.',
      'Niveles que suben y bajan según tus respuestas, y repaso automático de lo que fallas.',
      'Exámenes con el número de preguntas que elijas, sin ver las soluciones hasta entregar, con nota sobre 10 y corrección.',
      'Espera real cuando Google limita las peticiones, botón de cancelar si tarda y modelo configurable.',
      'Varios archivos por temario, estética morada y primera versión de la clasificación con Firebase.'
    ]
  },
  {
    v: 'Fase 1', date: '2026-11-02', approx: true,
    title: 'Primera versión',
    items: [
      'Página de inicio y herramienta de estudio: pegas o subes tus apuntes (PDF, Word, PowerPoint, TXT y MD) y la IA te pregunta.',
      'Versión en archivos sueltos para alojarla tú mismo en GitHub Pages y usarla desde cualquier sitio.'
    ]
  }
];
