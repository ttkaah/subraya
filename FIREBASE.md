# Activar la clasificación (Firebase, plan gratuito)

Solo se hace una vez. Plan Spark: gratis y sin tarjeta (50.000 lecturas y 20.000 escrituras al día en Firestore, y el acceso anónimo es gratuito).

1. Entra en https://console.firebase.google.com con tu cuenta de Google y pulsa **Crear un proyecto**. Ponle un nombre y desactiva Google Analytics (no hace falta).
2. Menú izquierdo → **Compilación → Authentication → Comenzar → pestaña Método de acceso → Correo electrónico/contraseña → Habilitar** (solo la primera casilla, no hace falta «Vínculo de correo electrónico») **→ Guardar**. Si ya usabas la clasificación antes de que existieran los perfiles, deja también activado **Anónimo**: tus perfiles antiguos lo necesitan hasta que les pongas contraseña.
3. **Compilación → Firestore Database → Crear base de datos**. Elige una ubicación en Europa (por ejemplo `eur3`) y el modo **producción**.
4. Dentro de Firestore, pestaña **Reglas**: borra lo que haya, pega el contenido del archivo `firestore.rules` y pulsa **Publicar**.
5. Rueda de ajustes (arriba a la izquierda) → **Configuración del proyecto → Tus apps → icono web `</>`**. Ponle un nombre, registra la app y copia el objeto `firebaseConfig`.
6. Abre `firebase-config.js`, sustituye `null` por ese objeto (hay un ejemplo dentro del archivo) y súbelo a GitHub junto con el resto de archivos.

## Archivos que tienes que subir a GitHub
`index.html`, `style.css`, `app.js`, `ranking.js` y `firebase-config.js`. Los demás (`FIREBASE.md`, `firestore.rules`, `README.md`) son solo guías.

## Si algo falla
- *«Activa Correo electrónico/contraseña…»*: repite el paso 2.
- *«Firebase rechazó la operación»*: repite el paso 4 y comprueba que pulsaste Publicar.
- *Dominio no autorizado*: Authentication → Configuración → Dominios autorizados → añade `TU_USUARIO.github.io`.

## Seguridad y moderación
- La `apiKey` de Firebase no es secreta, puede estar en un repositorio público. Lo que protege los datos son las reglas.
- Las reglas impiden que alguien edite el documento de otro jugador y limitan cuánto puede subir un marcador por escritura, pero **no pueden impedir del todo las trampas**: todo el código corre en el navegador. Es válido para un grupo de confianza, no para una competición seria.
- Opcional: en Google Cloud Console → APIs y servicios → Credenciales, restringe la clave de API a `https://TU_USUARIO.github.io/*`.
- Para borrar a alguien (apodo ofensivo, trampas): Firestore Database → colección `players` → documento del jugador → eliminar. Hazlo también en `weeks/<semana>/players` si aparece en el ranking semanal.
- Cada persona aparece una vez por navegador y dispositivo (la identidad es anónima y se guarda en el navegador).

## Perfiles (nombre y contraseña, sin correo)
- Cada persona crea un perfil con un nombre de usuario y una contraseña. Por dentro, Firebase usa un correo inventado derivado del nombre (nunca se envía ningún mensaje), y rechaza nombres repetidos sin distinguir mayúsculas.
- La contraseña la guarda Firebase Authentication, nunca está en tu código ni en Firestore.
- **No se puede recuperar una contraseña olvidada** (no hay correo). Esa persona tendría que crear otro perfil. Dile a tus compañeros que la apunten o que usen *Exportar progreso* como copia.
- Quien ya tenía un perfil anónimo de la versión anterior verá un aviso para ponerle contraseña. Conserva su puntuación.
- Un perfil solo ve y guarda sus propios temas en su navegador; **el progreso y los apuntes no se sincronizan** entre dispositivos (solo la clasificación y la foto).
- La foto se reduce a 96×96 px y se guarda dentro del documento del jugador (unos pocos KB). No se usa Firebase Storage porque exige un plan de pago. La ven todos los que miren la clasificación.

## Reglas: vuelve a publicarlas
Las reglas cambiaron (aceptan la foto y impiden cambiar el nombre de un perfil). Firestore Database → **Reglas** → pega el nuevo `firestore.rules` → **Publicar**.

## Moderar un perfil
Borra su documento en Firestore (`players/<id>` y, si aparece, `weeks/<semana>/players/<id>`) y su cuenta en **Authentication → Usuarios**.
