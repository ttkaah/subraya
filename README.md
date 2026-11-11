# Subraya

**Estudia contestando, no releyendo.**

Subraya es una herramienta de estudio con IA. Subes tus apuntes (PDF, Word, PowerPoint, TXT o Markdown) y la web te hace preguntas sobre ellos, adapta la dificultad a lo que vas respondiendo y te permite hacer exámenes con nota. Funciona en el navegador, sin instalar nada, y puedes alojarla gratis en GitHub Pages.

Es un proyecto personal, hecho para estudiar con mis compañeros.

<!-- Añade aquí capturas de pantalla: ![Práctica](docs/practica.png) -->

## Qué puedes hacer

**Estudiar**
- **Temarios guardados.** Cada tema que subes queda en una lista a la izquierda, con su nivel, rango y progreso. Puedes añadirle más archivos, renombrarlo o borrarlo.
- **Práctica con preguntas de la IA.** Test de 4 opciones, verdadero/falso y rellenar huecos, creados a partir de tus apuntes. Cada pregunta sale de una parte distinta del texto, y las que fallas vuelven más adelante.
- **Niveles adaptativos.** 300 niveles (60 etapas de 5), de «Novato» a «Prestigio XL». Subes con los aciertos, bajas con fallos seguidos, y cada etapa tiene su color y su dificultad.
- **Exámenes.** Eliges cuántas preguntas (de 3 a 40) y la dificultad. No ves las soluciones hasta entregar, y al final recibes tu **nota sobre 10** con la corrección completa. Opcionalmente, los fallos restan.
- **ELO y rangos.** Ganas ELO al acertar y pierdes al fallar, por temario y en total. Los rangos van de Hierro (200) a Radiante (51.200).
- **Extras.** Objetivo diario y racha de días, atajos de teclado (1–4 y Enter), sonidos opcionales, modo claro y oscuro, y exportar/importar tu progreso.

**Con Firebase (opcional)**
- **Perfiles** con nombre de usuario y contraseña, sin correo, y foto o avatar.
- **Clasificación** semanal, total y de precisión, con el rango de cada jugador.
- **Sincronización** de tus temarios entre dispositivos.
- **Sugerencias** para el administrador, con estado y respuesta.

**Dentro de la web:** una pestaña **Tutorial API** para conseguir la clave de Google, una de **Novedades** con el historial de cambios y otra de **Sugerencias**.

## Cómo funciona

- Todo el código se ejecuta en el navegador (HTML, CSS y JavaScript, sin compilar nada).
- La IA es **Gemini**, de Google. Cada persona usa **su propia clave de API gratuita** (se consigue en [Google AI Studio](https://aistudio.google.com), sin tarjeta). La clave se guarda solo en su navegador y se envía únicamente a Google.
- Los apuntes y el progreso se guardan en el navegador (IndexedDB). Sin Firebase, no sale nada de ahí salvo los fragmentos de texto que se mandan a Gemini para generar preguntas.
- Los PDF escaneados se leen con la propia IA (hasta 15 MB).

## Poner la web en marcha

1. Haz un fork o sube estos archivos a un repositorio de GitHub.
2. En el repositorio: **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save**.
3. En un par de minutos tendrás la web en `https://TU_USUARIO.github.io/TU_REPOSITORIO/`.
4. Abre la web, entra en **Tutorial API**, consigue tu clave y pégala en **Ajustes**.

Con eso ya funcionan la práctica, los exámenes, el ELO y los temarios. Las funciones de Firebase (perfiles, clasificación, sincronización y sugerencias) necesitan un paso más: sigue la guía [FIREBASE.md](FIREBASE.md) y pega tu configuración en `firebase-config.js`. Mientras ese archivo valga `null`, esas funciones quedan desactivadas y el resto de la web funciona igual.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Página, pestañas y pantalla de carga |
| `style.css` | Estilos (modo claro y oscuro) |
| `app.js` | Temarios, práctica, exámenes, niveles, ELO y rangos |
| `ranking.js` | Perfiles y clasificación |
| `sync.js` | Sincronización de temarios entre dispositivos |
| `suggest.js` | Pestaña de sugerencias |
| `updates.js` | Historial de novedades |
| `firebase-config.js` | Configuración de tu proyecto de Firebase |
| `firestore.rules` | Reglas de seguridad de la base de datos |
| `FIREBASE.md` | Guía para activar Firebase y moderar |
| `favicon.*`, `apple-touch-icon.png` | Iconos de la web |

Librerías que carga desde internet: [pdf.js](https://mozilla.github.io/pdf.js/), [mammoth](https://github.com/mwilliamson/mammoth.js), [JSZip](https://stuk.github.io/jszip/) y Firebase.

## Privacidad

- **Gemini** recibe fragmentos de tus apuntes para crear las preguntas. Revisa las condiciones de datos del plan gratuito de Google antes de usar material privado.
- **Firebase (si lo activas):** la clasificación comparte tu nombre, tu foto y tus contadores de aciertos. Si activas la sincronización, tus apuntes se guardan en tu cuenta; otros usuarios no pueden leerlos desde la web, pero quien administre el proyecto de Firebase sí podría verlos en su consola.
- No se usan cookies de seguimiento ni analíticas.

## Limitaciones

- **La IA se equivoca a veces.** Una pregunta puede salir mal formulada o con una respuesta discutible. Si algo no cuadra, contrástalo con tus apuntes.
- **Sin correo no hay recuperación de contraseña.** Quien olvide la suya tendrá que crear otro perfil.
- **Las trampas no se pueden evitar del todo:** como todo se ejecuta en el navegador, alguien con conocimientos podría falsear su puntuación. Vale para un grupo de confianza, no para una competición seria.
- **Cuotas gratuitas.** Gemini y Firestore tienen límites diarios. Si se agotan, hay que esperar al día siguiente.

## Créditos y aviso

Los nombres de los rangos están inspirados en los de Valorant; las insignias son un diseño propio. Este proyecto no está afiliado ni respaldado por Riot Games ni por Google.
