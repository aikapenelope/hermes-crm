# Design System — Hermes CRM

Referencia oficial del sistema visual. Este documento es la fuente de verdad.
**PROHIBIDO usar cualquier color azul o slate en este proyecto.**

---

## Paleta de colores

```
Background:        #070707  ← cuerpo de la app
Cards / panels:    #090909  ← contenedores, tablas
Inputs / selects:  #0a0a0a  ← fondo de campos de formulario
Active rows:       #0d0d0d  ← hover, filas seleccionadas

Text primary:      #ffffff  ← títulos, valores clave
Text secondary:    #888888  ← texto de cuerpo
Text muted:        #555555  ← meta, labels secundarios
Text ghost:        #444444  ← timestamps, counters
Text disabled:     #333333  ← texto inactivo

Border subtle:     #1a1a1a  ← divisores, cards
Border normal:     #222222  ← inputs en reposo
Border hover:      #333333  ← hover sobre elementos interactivos
Border active:     #ffffff  ← input con foco, elemento seleccionado

Accent único:      rainbow  ← linear-gradient(to right, #ff3333, #ffaa00, #00ffaa, #00aaff, #aa00ff)
                             Solo en: top-border de Sheet/Modal, nav item activo
```

## Colores prohibidos

```
❌  bg-blue-*       text-blue-*     border-blue-*
❌  bg-slate-*      text-slate-*    border-slate-*
❌  focus:ring-blue-*               focus:border-blue-*
❌  from-blue-*     to-violet-*     (en gradients de avatares)
```

---

## Componentes

### Btn

```svelte
<!-- primary: acción principal -->
<Btn variant="primary">   bg-white text-black hover:bg-[#e0e0e0]
<Btn variant="outline">   border-[#333] text-[#888] hover:border-white hover:text-white
<Btn variant="ghost">     text-[#555] hover:text-white
<Btn variant="danger">    bg-red-600 text-white hover:bg-red-500
<Btn variant="secondary"> border-[#333] text-[#888]
```

### Badge

Todas las variantes usan solo **borde sin relleno**:
```
slate:  border-[#333]           text-[#888]
blue:   border-white            text-white    ← "blue" = blanco en este sistema
green:  border-emerald-500/60   text-emerald-400
amber:  border-amber-500/60     text-amber-400
red:    border-red-500/60       text-red-400
orange: border-orange-500/60    text-orange-400
violet: border-violet-500/60    text-violet-400
```

### Sheet (panel lateral derecho)

```
bg: #080808  border-l: #1a1a1a
Top accent: rainbow gradient 1px
Header: text-white uppercase tracking-widest font-bold
Close button: text-[#444] hover:text-white
```

### Modal

```
bg: #080808  border: #1a1a1a
Top accent: rainbow gradient 1px
Confirm button: bg-white text-black (default) / bg-red-500 (danger)
Cancel button:  border-[#333] text-[#888]
```

### Input / Select / Textarea

```
bg: transparent (Input) / bg-[#0a0a0a] (Select)
border: border-[#222]
focus: focus:border-white
text: text-white
placeholder: text-[#444] tracking-widest uppercase
```

---

## Tipografía

```
Font family:     ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace
Font size body:  11px
Letter spacing:  0.08em (tracking-widest)
Text transform:  uppercase (todo el sistema)

Excepción títulos H1 y nombres propios:
  font-family: system-ui, sans-serif
  font-size: 14–28px
  letter-spacing: -0.01em a -0.02em
  text-transform: none (normal-case)
  font-weight: bold
```

| Uso | Tamaño | Clase |
|---|---|---|
| Labels / meta | 9px | `text-[9px] tracking-widest uppercase` |
| UI principal | 10px | `text-[10px] tracking-widest` |
| Body | 11px | `text-[11px]` |
| Énfasis | 12px | `text-[12px]` |
| Subtítulos | 13–14px | `font-sans normal-case` |

---

## Cards y contenedores

```svelte
<!-- Card estándar -->
<div class="border border-[#1a1a1a] bg-[#090909] p-5">

<!-- Tabla -->
<div class="overflow-hidden border border-[#1a1a1a] bg-[#090909]">
  <table>
    <thead>
      <tr class="border-b border-[#1a1a1a]">
        <th class="px-4 py-3 text-[9px] text-[#444] uppercase tracking-widest">

<!-- Fila hover -->
<tr class="group hover:bg-[#111] transition-colors">

<!-- Dividers -->
<tbody class="divide-y divide-[#1a1a1a]">
```

---

## Acciones rápidas (pattern estándar)

```svelte
<!-- Botones de acción que aparecen en hover de fila -->
<div class="opacity-0 group-hover:opacity-100 transition-opacity">
  <button class="p-1.5 text-[#444] hover:bg-[#111] hover:text-white transition-colors">
    <Pencil class="h-3.5 w-3.5" />
  </button>
  <button class="p-1.5 text-[#444] hover:bg-red-900/40 hover:text-red-400 transition-colors">
    <Trash2 class="h-3.5 w-3.5" />
  </button>
</div>
```

---

## Sidebar nav

```
Active item:    bg-[#111] text-white  +  top rainbow border 1px
Inactive item:  text-[#888] hover:text-white
Group label:    text-[#444] text-[9px] tracking-widest uppercase
Brand:          font-sans font-bold text-white  (HERMES.CRM)
```
