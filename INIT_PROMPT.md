Quiero que diseñes e implementes un servidor MCP, Model Context Protocol, específico para automatizar Aseprite.

## Objetivo

Crear un MCP que permita a agentes de IA controlar Aseprite para crear, editar, inspeccionar y exportar sprites, animaciones pixel art, tilesets y spritesheets.

El MCP debe funcionar como una capa segura entre un cliente compatible con MCP, como Codex, Claude Desktop u otro agente, y Aseprite.

## Stack preferido

* TypeScript
* Node.js
* SDK oficial de MCP
* Comunicación con Aseprite mediante su CLI y scripts Lua
* Arquitectura modular y extensible
* Compatible inicialmente con Windows, pero evitando dependencias innecesariamente específicas del sistema operativo

Usa Python únicamente si existe una razón técnica clara. Prioriza TypeScript.

## Antes de implementar

Primero investiga las capacidades reales de:

* Aseprite CLI
* Aseprite scripting API con Lua
* Formato `.ase` y `.aseprite`
* Importación y exportación de spritesheets
* Tags, frames, layers, cels, slices, palettes y tilesets
* SDK y especificación actual de MCP

No inventes comandos ni APIs de Aseprite. Verifica cada operación contra documentación oficial o contra el comportamiento real de Aseprite.

## Alcance funcional

Implementa herramientas MCP para las siguientes operaciones.

### Información del proyecto

* `aseprite_get_document_info`
* `aseprite_list_frames`
* `aseprite_list_layers`
* `aseprite_list_tags`
* `aseprite_list_slices`
* `aseprite_get_palette`
* `aseprite_get_canvas_size`
* `aseprite_get_pixel`
* `aseprite_inspect_region`

Estas herramientas deben devolver información estructurada en JSON, no únicamente texto.

### Creación de archivos

* `aseprite_create_sprite`
* `aseprite_create_animation`
* `aseprite_create_layer`
* `aseprite_create_frame`
* `aseprite_create_tag`
* `aseprite_create_slice`
* `aseprite_create_palette`
* `aseprite_create_tileset`

La creación de sprites debe permitir configurar:

* width
* height
* color mode
* transparent color
* frame count
* frame duration
* background
* output path

### Edición de pixel art

* `aseprite_set_pixel`
* `aseprite_set_pixels`
* `aseprite_fill_region`
* `aseprite_clear_region`
* `aseprite_draw_line`
* `aseprite_draw_rectangle`
* `aseprite_draw_ellipse`
* `aseprite_flood_fill`
* `aseprite_replace_color`
* `aseprite_move_region`
* `aseprite_flip_region`
* `aseprite_rotate_region`
* `aseprite_copy_cel`
* `aseprite_link_cels`

Para operaciones con múltiples píxeles, acepta estructuras compactas que eviten llamadas individuales excesivas.

Ejemplo:

```json
{
  "pixels": [
    { "x": 1, "y": 2, "color": "#FF0000FF" },
    { "x": 2, "y": 2, "color": "#00FF00FF" }
  ]
}
```

También contempla una representación por matriz o por segmentos horizontales para modificar regiones grandes eficientemente.

### Capas y frames

* `aseprite_rename_layer`
* `aseprite_delete_layer`
* `aseprite_set_layer_visibility`
* `aseprite_set_layer_opacity`
* `aseprite_reorder_layer`
* `aseprite_duplicate_layer`
* `aseprite_rename_frame`
* `aseprite_delete_frame`
* `aseprite_set_frame_duration`
* `aseprite_duplicate_frame`
* `aseprite_reorder_frame`

### Animaciones

* Crear tags con dirección:

  * forward
  * reverse
  * ping-pong
  * ping-pong-reverse
* Configurar duración individual de frames
* Duplicar secuencias
* Insertar frames intermedios
* Copiar cels entre frames
* Consultar información de una animación por tag

Incluye herramientas como:

* `aseprite_get_animation_info`
* `aseprite_set_tag_range`
* `aseprite_set_tag_direction`
* `aseprite_duplicate_animation`
* `aseprite_export_animation_preview`

### Paletas

* `aseprite_add_palette_color`
* `aseprite_remove_palette_color`
* `aseprite_replace_palette`
* `aseprite_sort_palette`
* `aseprite_map_colors_to_palette`
* `aseprite_import_palette`
* `aseprite_export_palette`

Los colores deben aceptar formatos como:

* `#RRGGBB`
* `#RRGGBBAA`
* RGBA estructurado

Normaliza internamente los colores.

### Importación y exportación

* `aseprite_open_document`
* `aseprite_save_document`
* `aseprite_save_document_as`
* `aseprite_export_png`
* `aseprite_export_frames`
* `aseprite_export_spritesheet`
* `aseprite_export_gif`
* `aseprite_export_json_metadata`
* `aseprite_import_image`
* `aseprite_import_spritesheet`

La exportación de spritesheet debe permitir configurar:

* rows
* columns
* horizontal strip
* vertical strip
* packed layout
* padding
* border padding
* inner padding
* trim
* merge duplicates
* scale
* selected layers
* selected tags
* JSON metadata
* filename format

### Operaciones de alto nivel

Además de primitivas de edición, implementa herramientas de mayor nivel para agentes de IA:

* `aseprite_create_character_template`
* `aseprite_create_walk_cycle`
* `aseprite_create_idle_animation`
* `aseprite_create_directional_animation`
* `aseprite_generate_tileset_template`
* `aseprite_create_nine_slice`
* `aseprite_apply_palette`
* `aseprite_outline_sprite`
* `aseprite_add_drop_shadow`
* `aseprite_scale_pixel_art`
* `aseprite_validate_sprite`
* `aseprite_compare_frames`

Estas herramientas no deben depender de IA generativa interna. Deben ejecutar operaciones deterministas basadas en parámetros.

Por ejemplo, `aseprite_create_walk_cycle` puede crear la estructura de frames, capas, tags y duraciones, aunque el contenido visual se proporcione como matrices de píxeles o como archivos externos.

## Recursos MCP

Expón recursos que permitan consultar:

* Documentos abiertos o disponibles
* Metadata de archivos `.aseprite`
* Paletas disponibles
* Tags de animación
* Capas
* Frames
* Exportaciones recientes
* Capacidades disponibles del servidor
* Ruta y versión detectada de Aseprite

Ejemplos de URI:

```text
aseprite://documents
aseprite://document/{documentId}
aseprite://document/{documentId}/layers
aseprite://document/{documentId}/frames
aseprite://document/{documentId}/tags
aseprite://document/{documentId}/palette
aseprite://capabilities
aseprite://config
```

## Prompts MCP opcionales

Incluye prompts reutilizables como:

* Crear un personaje pixel art
* Crear un ciclo de caminata
* Preparar un spritesheet para Unity
* Preparar un spritesheet para Godot
* Crear un tileset
* Revisar consistencia entre frames
* Reducir una imagen a una paleta limitada
* Exportar una animación para web

## Arquitectura

Organiza el proyecto aproximadamente así:

```text
src/
  index.ts
  server.ts
  config/
  tools/
    document/
    drawing/
    animation/
    palette/
    export/
    high-level/
  resources/
  prompts/
  aseprite/
    cli.ts
    lua-runner.ts
    command-builder.ts
    discovery.ts
  schemas/
  security/
  utils/
scripts/
  lua/
tests/
  unit/
  integration/
examples/
```

Puedes ajustar la estructura si encuentras una opción mejor, pero conserva separación de responsabilidades.

## Integración con Aseprite

Diseña una capa de abstracción para Aseprite que pueda:

1. Detectar el ejecutable de Aseprite.
2. Aceptar una ruta configurada manualmente.
3. Ejecutar comandos CLI.
4. Generar scripts Lua temporales.
5. Ejecutar scripts Lua mediante Aseprite.
6. Capturar salida estructurada.
7. Capturar errores.
8. Limpiar archivos temporales.
9. Aplicar timeouts.
10. Evitar ejecuciones concurrentes peligrosas sobre el mismo archivo.

Cuando Aseprite no permita una operación directamente por CLI, genera un script Lua específico.

Evita crear un script Lua distinto y duplicado para cada llamada cuando sea posible. Diseña un runner genérico que reciba una operación y parámetros serializados de manera segura.

## Manejo de estado

Prefiere operaciones basadas en rutas de archivos y IDs internos controlados por el servidor.

No dependas de que Aseprite tenga una ventana abierta.

Si necesitas mantener documentos temporalmente abiertos, diseña un administrador de sesiones con:

* documentId
* filePath
* temporaryPath
* dirty state
* last modified
* lock status

Documenta claramente qué operaciones son stateless y cuáles usan sesión.

## Seguridad

El servidor debe ser seguro para uso local.

Implementa:

* Lista configurable de directorios permitidos
* Validación y normalización de rutas
* Prevención de path traversal
* Restricción de escritura fuera del workspace permitido
* Lista permitida de extensiones
* Límite de tamaño de imágenes
* Límite de cantidad de frames
* Límite de dimensiones del canvas
* Timeout para procesos
* Límite de salida de procesos
* Limpieza de temporales
* Sanitización de argumentos
* Prohibición de ejecutar Lua arbitrario enviado directamente por el cliente
* Prohibición de ejecutar comandos shell arbitrarios
* Confirmación opcional para sobrescribir archivos

No expongas una herramienta genérica como `run_lua`, `execute_command` o `run_shell`.

## Validación

Usa esquemas estrictos para todas las herramientas.

Valida:

* Tipos
* Rangos
* Coordenadas
* Dimensiones
* Duraciones
* Índices de frame
* Nombres de layers y tags
* Colores
* Rutas
* Formatos de exportación
* Cantidad máxima de operaciones por llamada

Devuelve errores estructurados y fáciles de corregir.

Ejemplo:

```json
{
  "code": "FRAME_OUT_OF_RANGE",
  "message": "El frame 8 no existe.",
  "details": {
    "requestedFrame": 8,
    "availableFrames": 6
  }
}
```

## Transacciones y respaldo

Las herramientas destructivas deben poder trabajar con:

* `createBackup`
* `dryRun`
* `overwrite`
* `saveAfterOperation`

Cuando sea posible:

1. Trabaja sobre una copia temporal.
2. Valida el resultado.
3. Reemplaza el archivo original de forma atómica.
4. Conserva un respaldo cuando se solicite.

## Respuestas visuales

Cuando una herramienta modifique un sprite, devuelve:

* Resumen de cambios
* Ruta del archivo resultante
* Frames afectados
* Layers afectadas
* Dimensiones
* Advertencias
* Ruta opcional de una preview PNG
* Metadata suficiente para que el agente pueda verificar el resultado

Ejemplo:

```json
{
  "success": true,
  "filePath": "output/player.aseprite",
  "previewPath": "output/previews/player-frame-1.png",
  "changes": {
    "framesModified": [0, 1, 2, 3],
    "layersModified": ["body", "outline"]
  },
  "warnings": []
}
```

## Configuración

Permite configuración mediante variables de entorno y archivo JSON.

Variables sugeridas:

```text
ASEPRITE_PATH
ASEPRITE_MCP_ALLOWED_DIRECTORIES
ASEPRITE_MCP_TEMP_DIRECTORY
ASEPRITE_MCP_MAX_WIDTH
ASEPRITE_MCP_MAX_HEIGHT
ASEPRITE_MCP_MAX_FRAMES
ASEPRITE_MCP_PROCESS_TIMEOUT
ASEPRITE_MCP_ALLOW_OVERWRITE
ASEPRITE_MCP_LOG_LEVEL
```

## Compatibilidad con clientes MCP

Incluye configuración de ejemplo para:

* Codex
* Claude Desktop
* VS Code o cualquier cliente MCP basado en stdio

El transporte inicial debe ser `stdio`.

Diseña la implementación para que después pueda agregarse HTTP o Streamable HTTP sin reescribir la lógica de negocio.

## Pruebas

Incluye:

* Pruebas unitarias de schemas
* Pruebas de normalización de rutas
* Pruebas del command builder
* Pruebas del generador de Lua
* Pruebas de colores
* Pruebas de coordenadas
* Pruebas de operaciones destructivas
* Pruebas de exportación
* Pruebas de concurrencia y locking

Las pruebas de integración que requieren Aseprite deben poder omitirse cuando el ejecutable no esté instalado.

Usa fixtures pequeños de pixel art.

## Documentación

Crea un `README.md` completo con:

* Qué hace el MCP
* Requisitos
* Instalación
* Configuración
* Cómo localizar Aseprite
* Cómo compilar
* Cómo ejecutar
* Cómo conectarlo a Codex
* Cómo conectarlo a Claude Desktop
* Herramientas disponibles
* Recursos disponibles
* Ejemplos de uso
* Limitaciones
* Seguridad
* Troubleshooting

Incluye ejemplos reales de llamadas para:

1. Crear un sprite de 32×32.
2. Dibujar varios píxeles.
3. Crear cuatro frames.
4. Crear el tag `idle`.
5. Exportar un spritesheet.
6. Consultar la paleta.
7. Generar una preview.
8. Modificar un archivo existente de manera segura.

## Entregables

Genera:

1. Proyecto completo y funcional.
2. Código TypeScript compilable.
3. Scripts Lua necesarios.
4. Schemas de entrada y salida.
5. Pruebas.
6. README.
7. Archivo de configuración de ejemplo.
8. Ejemplos de integración MCP.
9. Un sprite de prueba generado por el MCP.
10. Una lista de limitaciones reales de Aseprite.

## Forma de trabajo

No intentes implementar todo de golpe sin validar la arquitectura.

Trabaja en este orden:

### Fase 1: análisis

* Revisa el repositorio actual.
* Investiga APIs reales.
* Define arquitectura.
* Define herramientas soportadas.
* Identifica limitaciones.
* Presenta un plan breve.

### Fase 2: núcleo

Implementa:

* Servidor MCP
* Configuración
* Detección de Aseprite
* Runner CLI
* Runner Lua
* Validación
* Seguridad de rutas
* Manejo de errores

### Fase 3: MVP

Implementa primero estas herramientas:

* `aseprite_create_sprite`
* `aseprite_get_document_info`
* `aseprite_list_layers`
* `aseprite_list_frames`
* `aseprite_set_pixels`
* `aseprite_create_frame`
* `aseprite_create_tag`
* `aseprite_save_document`
* `aseprite_export_png`
* `aseprite_export_spritesheet`

### Fase 4: pruebas reales

* Compila el proyecto.
* Ejecuta las pruebas.
* Corrige errores.
* Prueba el MCP con un archivo real.
* Genera un sprite de ejemplo.
* Comprueba el PNG exportado.
* Comprueba el spritesheet y su metadata.

### Fase 5: ampliación

Después de que el MVP funcione, implementa las demás operaciones priorizando:

1. Animaciones
2. Paletas
3. Edición de regiones
4. Tilesets
5. Herramientas de alto nivel

## Reglas de implementación

* No dejes pseudocódigo donde sea posible implementar código real.
* No declares que algo funciona sin compilarlo o probarlo.
* No ocultes errores de TypeScript.
* No uses `any` salvo que sea inevitable y esté justificado.
* No uses comandos shell concatenados como strings.
* Usa APIs de procesos con argumentos separados.
* No permitas Lua arbitrario desde entradas MCP.
* No sobrescribas archivos del usuario durante pruebas.
* Documenta las limitaciones técnicas reales.
* Mantén nombres consistentes.
* Agrega comentarios únicamente donde expliquen decisiones no obvias.
* Implementa primero un MVP sólido antes de agregar decenas de herramientas incompletas.

Al terminar, muestra:

1. Resumen de la arquitectura.
2. Árbol de archivos.
3. Herramientas implementadas.
4. Herramientas pendientes.
5. Comandos para instalar, compilar y ejecutar.
6. Configuración MCP de ejemplo.
7. Resultado de las pruebas.
8. Limitaciones conocidas.
9. Ejemplo completo de creación y exportación de una animación.
