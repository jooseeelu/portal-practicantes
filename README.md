# Portal de prácticas · Gestoría eMadrid

Portal **interno** para gestionar candidatos y estudiantes en prácticas: de la recepción del currículum a la finalización de las prácticas.

> **Estado: prototipo visual navegable.** Todos los datos son inventados y nada se guarda al recargar. Sirve para decidir el diseño y el flujo antes de construir el portal definitivo.

## Ver el prototipo

Hace falta Node.js (solo para servir los archivos; no hay dependencias que instalar).

```bash
node prototipo/servidor.cjs
```

Y abrir <http://localhost:5180>.

## Qué incluye

- **Inicio:** indicadores, alertas, próximas entrevistas, embudo por fase y quién está hoy en cada turno.
- **Candidatos:** tabla, tarjetas y Kanban (arrastrar para cambiar de estado), búsqueda, filtros combinables y vistas rápidas.
- **Ficha:** información personal, formación, visor de currículum, entrevista con valoración 0–10 por criterios, a favor y en contra, documentación, historial y observaciones internas. Foto opcional.
- **Entrevistas:** calendario semanal y listado; entrevistador opcional.
- **Estudiantes en prácticas:** listado con avance y cuadrante de turnos con aforo.
- **Centros educativos, Documentos y Ajustes** (estados, turnos y aforo, equipo, protección de datos, integraciones).

## Tecnología

Vue 3 sin paso de compilación (módulos ES, mismo enfoque que el CRM `emadrid-pwa-vue`). Vue se incluye en `prototipo/vendor` para funcionar sin internet; solo las tipografías se cargan desde Google Fonts.

## Siguientes pasos previstos

PocketBase propio (autenticación con doble verificación, archivos protegidos, copias), sincronización de la agenda con Notion y avisos por WhatsApp (API de Meta vía Chatwoot y n8n).
