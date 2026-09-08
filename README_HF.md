---
title: Music Practice & Stem Lab Backend
emoji: 🎵
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Music Practice & Stem Lab API (Backend)

Backend de IA para separación de pistas musicales en stems (Batería, Bajo, Guitarra, Voz, Piano, Otros), estimación de acordes/BPM/escala musical y transcripción con Demucs.

### Endpoints principales
- `POST /api/v1/tracks/upload` : Subir y procesar archivo de audio.
- `GET /api/v1/tracks/{id}/session` : Obtener datos de sesión analizada y URLs de stems.
- `WS /api/v1/ws/tracks/{id}` : Telemetría en vivo del avance del procesamiento.
- `GET /stems/{path}` : Descarga de stems separados para el reproductor multicanal.
