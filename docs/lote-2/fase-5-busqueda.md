# Búsqueda y sugerencias

Una migración aditiva agrega searchText a productos, marcas y categorías,
rellena únicamente esas columnas e instala triggers para mantenerlas al crear,
editar o renombrar. No cambia nombres, cantidades, identificadores ni contenido
comercial. La normalización elimina tildes (también combinaciones Unicode),
unifica mayúsculas y espacios. Incluye nombre, SKU, marca y categoría asignada.
Las palabras se combinan con AND, sin depender de su orden.

Se reutiliza pg_trgm que ya instaló POS: no se agrega ninguna extensión.
Tres índices GIN permiten búsquedas parciales sobre el texto normalizado.
Sugerencias desde tres caracteres para aprovechar trigramas; máximo 80 caracteres,
ocho palabras y ocho resultados (hasta cuatro productos, dos categorías y dos
marcas). Categorías con ancestros ocultos y marcas ocultas no aparecen.

La cabecera deja de descargar el índice completo al escribir. Espera 250 ms,
cancela la petición anterior y descarta respuestas antiguas. Flechas y Enter
seleccionan; Escape cierra mediante el comportamiento existente. Combobox,
listbox y estado anunciado para lectores de pantalla. Límite de 120 consultas
por minuto/IP; los fallos permiten buscar en catálogo con Enter.

El catálogo reutiliza la misma normalización del cliente sobre sus tarjetas;
la API también admite q por nombre, marca y categoría. No se usa el buscador
de POS ni se alteran códigos de barras o sesiones.

Publicación futura: respaldo, migración, Prisma Client y API antes del cliente.
El relleno y los índices pueden bloquear según volumen: medir en una copia
autorizada antes de la ventana. No se mide ni aplica contra producción ahora.
Rollback funcional: código anterior con columnas/índices/triggers conservados;
no borrar registros ni modificar SQL ya aplicado.

Cinco pruebas PostgreSQL correctas: normalización SQL/cliente (incluye Unicode
descompuesto), búsquedas de nombre/marca/categoría, datos mínimos y ancestros
ocultos, renombrados sin alterar stock, límite por IP, tres índices y diff Prisma.
