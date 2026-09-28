# Cómo usar el Escritorio Jurídico

Ábrela en cualquier computador: https://kirit0-1.github.io/escritorio-juridico/

Esta guía es corta. Léela de arriba hacia abajo.

## 1. Abrir la aplicación

1. Abre la carpeta del proyecto.
2. En la terminal escribe:

```
npm start
```

3. En el navegador entra a: http://127.0.0.1:4173/

Arriba a la derecha verás una pastilla verde.

- Si dice **Guardado en este equipo**, los datos están en tu computador.
- Si dice **Guardado en Supabase**, los datos están en la nube.

## 2. Ponle tu nombre

La primera pantalla pide tres cosas:

1. Nombre del estudio
2. Tu nombre
3. Tu cargo

Pulsa **Guardar**. El menú de la izquierda y el saludo cambian a tu nombre.

Más adelante puedes cambiar el color en **Configuración**.

## 3. Crea un cliente

1. Pulsa **Clientes**.
2. Pulsa **Agregar cliente**.
3. Escribe nombre, teléfono, correo y una nota corta.
4. Elige un color. Ese color marca sus casos.
5. Pulsa **Guardar cliente**.

El cliente se queda aunque cierres sus casos.

## 4. Crea un caso

1. Pulsa **Casos** y luego **Nuevo caso**.
2. Pon el nombre, la materia y elige el cliente.
3. El estado puede ser **En preparación**, **En curso** o **Urgente**.
4. Pulsa **Guardar caso**.
5. Haz clic en el caso para ver su ficha.

Dentro del caso hay pestañas:

- **Resumen**: los datos principales
- **Documentos**: el archivo queda guardado. Pulsa **Ver** para abrirlo. El asistente lee PDF y texto; si es una foto, solo se puede ver
- **Cronología**: las fechas de ese caso
- **Tareas**: lo que falta hacer. Al marcar la casilla, se tacha
- **Notas**: tus apuntes. Pulsa **Guardar**
- **Fuentes**: leyes o fallos que tú agregaste
- **Asistente IA**: un borrador para revisar. No es un consejo legal

## 5. Agenda y búsqueda

- **Agenda**: audiencias, plazos y reuniones.
- La barra de arriba filtra la lista mientras escribes.
- **Buscar** mira casos, clientes, documentos y biblioteca.

## 6. Cerrar un caso

Cuando el caso termina, sus datos se borran para no ocupar espacio.

1. Abre el caso.
2. Pulsa **Cerrar y borrar**.
3. Confirma.

Se eliminan el caso, sus documentos, tareas, notas y fechas.

El cliente no se borra.

También puedes editar el caso, elegir el estado **Cerrado** y guardar. Pasa lo mismo.

## 7. Buscar una ley

1. Pulsa **Biblioteca**.
2. Escribe, por ejemplo, **Código del Trabajo**.
3. Pulsa **Buscar**.
4. **Abrir** muestra la ley en Ley Chile.
5. **Guardar** deja el enlace en tu biblioteca. El texto de la ley no se copia.

## 8. El otro computador

La dirección de Supabase ya está puesta: `https://nylehvwrizerbdfmpomt.supabase.co`.

Falta la clave pública para que los dos computadores vean lo mismo.

1. En Supabase abre **SQL Editor**, pega todo `supabase/schema.sql` y pulsa **Run**.
2. Entra a **Project Settings → API**.
3. Copia la clave que dice **anon** o **public**. Empieza con `eyJ`. No copies la que dice **service_role**.
4. Pega esa clave en `server/supabase-public.js`, en `SUPABASE_ANON_KEY`.
5. En el otro computador abre esta misma carpeta desde GitHub y escribe `npm start`.

La pastilla verde debe decir **Guardado en Supabase**.
