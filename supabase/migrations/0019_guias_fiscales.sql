-- ============================================================================
-- MEDISYS · Centro de Ayuda: guías de los módulos fiscales (Venezuela)
-- ============================================================================
-- Agrega la categoría «Gestión Fiscal y Administrativa (Venezuela)» con tres
-- guías para los módulos de Administración (0016), Facturación (0017) y
-- Contabilidad (0018):
--
--   1. Configuración de entidad, tasa BCV y servicios.
--   2. Emisión de facturas e IGTF (3%).
--   3. Libro de Ventas SENIAT, cierre de caja y honorarios.
--
-- IDEMPOTENTE: usa `on conflict (slug) do nothing`, por lo que volver a
-- ejecutarla NO sobrescribe las ediciones hechas por el Super Admin.
-- Se publican (`is_published = true`) para que aparezcan en /guias y en el
-- Centro de Ayuda de cada clínica.
-- ============================================================================

insert into public.guide_pages (slug, title, category, order_index, content_markdown, is_published)
values
  (
    'configuracion-fiscal-tasa-servicios',
    'Configuración de entidad, tasa BCV y servicios',
    'Gestión Fiscal y Administrativa (Venezuela)',
    1,
    $md$# Configuración de entidad, tasa BCV y servicios

Esta guía reúne los tres ajustes que deben estar listos **antes de facturar**:
los datos fiscales de la clínica, la tasa oficial del dólar y el catálogo de
servicios con sus honorarios.

> **Quién puede hacerlo:** los roles **Administrador** y **Contador**.

## 1. Datos fiscales de la entidad

Ve a **Configuración de la Clínica → Datos fiscales de la entidad** y completa:

| Campo | Para qué sirve | Ejemplo |
| --- | --- | --- |
| Razón social | Nombre legal que irá en la factura | IBEARTS, C.A. |
| RIF | Identificación ante el SENIAT | J-40123456-7 |
| Domicilio fiscal | Dirección declarada ante el SENIAT | Av. Bolívar, Torre Médica, Piso 3 |
| Teléfono de contacto | Aparece en la factura | 0212-5551234 |
| Correo fiscal | Recibe facturas y notas de crédito | facturacion@clinica.com.ve |
| Imprenta autorizada | Solo si usas formas libres | Imprenta Nacional, C.A. |
| N° de providencia | Providencia que autoriza las formas libres | SNAT/2024/000123 |

**Formatos aceptados:** el RIF se escribe con la letra **V, E, J o G**, ocho
dígitos y el dígito verificador (`V-12345678-9`). El sistema normaliza puntos,
guiones y espacios, así que puedes escribir `j-40.123.456-7` y se guardará
correctamente.

> **Importante:** si un dato obligatorio queda vacío o mal formado, el sistema
> te avisa campo por campo y no guarda nada. Corrige y vuelve a pulsar
> **Guardar datos fiscales**.

## 2. Tasa oficial BCV del día

En **Configuración de la Clínica → Tasa oficial BCV y multimoneda** verás la
tasa vigente, su origen y su fecha de actualización.

### Cómo se obtiene la tasa (automático)

Medisys consulta la tasa en cascada, de la fuente más fresca a la más estable:

1. **Portal del BCV** (bcv.org.ve) en vivo.
2. **APIs públicas** de respaldo si el portal no responde.
3. **Última tasa guardada** en tu clínica.
4. **Valor de respaldo** del sistema, solo si todo lo anterior falla.

Con el interruptor **Actualización automática desde el BCV** activo, la
plataforma refresca la tasa del día sola (también hay una tarea programada
diaria) y la guarda como respaldo.

### Sobreescritura manual (override)

Si necesitas fijar una tasa distinta (por ejemplo, una tasa acordada por
convenio), escribe el monto en **Tasa manual (Bs/USD)**, elige la fecha de
vigencia y pulsa **Guardar tasa manual**.

- Una tasa **manual vigente tiene prioridad** sobre la automática.
- Al desactivar el interruptor automático, la última tasa registrada queda
  congelada hasta que la cambies.
- Cada registro queda en el historial con su fuente (`BCV` o `MANUAL`), así
  siempre puedes auditar qué tasa se aplicó y cuándo.

Pulsa **Consultar BCV ahora** para forzar una consulta inmediata antes de un
cierre o de emitir una factura.

> **Tip:** revisa la tasa al abrir la caja del día. La factura guarda la tasa
> aplicada en el momento del cobro, así que las facturas ya emitidas no cambian
> si luego la tasa sube.

## 3. Sedes de la clínica

Si atiendes en más de un local, créalas en **Sedes de la clínica**:

1. Pulsa **Nueva sede**.
2. Escribe el nombre (por ejemplo, «Sede Chacao»), la dirección y el teléfono.
3. Marca **Sede principal** en la que factura por defecto.
4. Marca **Sede activa** para que aparezca en la agenda y en la caja.

El personal con sedes asignadas trabaja sobre su sede; si no se le asigna
ninguna, verá todas las de la clínica.

## 4. Catálogo de servicios con IVA y honorarios

Ve a **Servicios y honorarios** en el panel. Cada servicio tiene:

| Campo | Descripción |
| --- | --- |
| Nombre | Cómo lo verá la recepción (ej. «Consulta Cardiología General») |
| Código | Código interno o de procedimiento, único por clínica (ej. `CAR-001`) |
| Precio (USD) | Precio base del servicio en dólares |
| Sujeto a IVA (16%) | Marca **solo** si el servicio es gravado |
| Honorario del médico | Porcentaje del servicio o monto fijo en USD |

### Sobre el IVA

La mayoría de los **servicios médicos directos están exentos de IVA** (Art. 17
de la Ley de IVA). Por eso el formulario crea todo con la casilla **sin
marcar** = *exento*. Márcala únicamente para conceptos gravados (por ejemplo,
venta de productos o servicios no médicos): el sistema calculará el 16% y lo
mostrará en la factura y en el Libro de Ventas.

### Sobre los honorarios

Al escribir el precio aparece la vista previa del cálculo, para que sepas
exactamente qué pasará al facturar:

- **Subtotal**, **IVA** y **Total al paciente**.
- **Honorario médico**, según el tipo elegido:
  - **Porcentaje:** `precio × %` (ej. 40% de una consulta de $25,50 = $10,20).
  - **Monto fijo:** siempre en USD y nunca mayor al precio del servicio.

> **Buenas prácticas:** usa códigos cortos y estables (`CAR-001`, `ECO-003`),
> revisa los precios una vez al mes y confirma el porcentaje del médico antes
> de la primera facturación del período. Los honorarios se pagan después en
> **Contabilidad y caja → Honorarios médicos**.

## 5. Checklist antes de tu primera factura

- [ ] Razón social, RIF y domicilio fiscal guardados.
- [ ] Teléfono y correo fiscales cargados.
- [ ] Tasa BCV revisada (automática o manual).
- [ ] Al menos una sede registrada, con su sede principal marcada.
- [ ] Servicios creados con precio, IVA y honorario correctos.
- [ ] Personal con su rol asignado (Administrador, Recepción, Médico, Contador).
$md$
  ),
  (
    'facturacion-e-igtf',
    'Emisión de facturas e IGTF (3%)',
    'Gestión Fiscal y Administrativa (Venezuela)',
    2,
    $md$# Emisión de facturas e IGTF (3%)

Guía para cerrar una consulta y entregar la factura fiscal del paciente, con el
desglose de IVA y la percepción del **IGTF (3%)** cuando se cobra en divisas.

> **Quién puede hacerlo:** **Administrador** y **Recepción**. El Contador puede
> consultar todo el historial y emitir notas, pero no cobrar en caja.

## 1. Antes de empezar

Cada factura emitida consume dos números fiscales correlativos:

| Número | Qué es | Ejemplo |
| --- | --- | --- |
| N° de factura | Correlativo de la factura | 00000042 |
| N° de control | Control de formas libres exigido por el SENIAT | 00-00000042 |

Si guardas un **borrador**, no se consume numeración: el borrador solo deja
listo el contenido para revisarlo o completarlo después.

> **Nota:** si el sistema indica que faltan punteros fiscales o el Número de
> Control, la base de datos no tiene aplicada la migración del módulo de
> facturación. Avisa a soporte antes de facturar.

## 2. Datos fiscales del paciente (obligatorios)

El SENIAT exige identificar al comprador. En el formulario de emisión completa:

| Tipo de documento | Cuándo usarlo | Formato |
| --- | --- | --- |
| **V** | Venezolano (cédula) | V-12345678 |
| **E** | Extranjero (cédula) | E-12345678 |
| **J** | Persona jurídica (RIF) | J-40123456-7 |
| **G** | Ente gubernamental | G-20012345-6 |
| **P** | Pasaporte | AB123456 |

Además son obligatorios la **razón social o nombre a facturar** y la
**dirección fiscal**. Si el paciente está registrado, al seleccionarlo el
sistema rellena todo automáticamente desde su ficha; si es un cliente invitado,
escríbelo a mano. El correo y el teléfono son opcionales.

> **Importante:** sin documento, razón social y dirección fiscal el sistema no
> emite la factura. Es una validación del SENIAT, no un error de la plataforma.

## 3. Métodos de cobro y cuándo aplica el IGTF

El IGTF (Impuesto a las Grandes Transacciones Financieras) es del **3%** y
grava el **medio de pago**, no la venta. Se calcula sobre el monto cobrado y se
suma al total a pagar:

| Método de cobro | Moneda | ¿Aplica IGTF 3%? | ¿Pide referencia? |
| --- | --- | --- | --- |
| Pago Móvil | Bs. | No | Sí (últimos 4-6 dígitos) |
| Transferencia (Bs.) | Bs. | No | Sí |
| Punto de venta | Bs. | No | No |
| Efectivo Bs. | Bs. | No | No |
| **Zelle** | USD | **Sí** | Sí (código de confirmación) |
| **Efectivo USD** | USD | **Sí** | No |

Ejemplo con una consulta de **$25,50 exenta de IVA**:

1. Base cobrada: **$25,50**.
2. IGTF 3%: **$0,77** (`25,50 × 3%`).
3. **Total a pagar: $26,27** (equivalente en bolívares a la tasa del día).

Con Pago Móvil por el mismo servicio: base $25,50, **sin IGTF**, total $25,50
en bolívares.

## 4. Paso a paso: emitir la factura (cierre de consulta)

1. Entra a **Facturación y cobros** en el panel y quédate en la pestaña
   **Emitir factura**.
2. Elige el **paciente registrado** o deja «Cliente invitado» y escribe los
   datos fiscales a mano.
3. Verifica **tipo de documento, número, razón social y dirección fiscal**.
4. Selecciona la **sede** que factura (si trabajas con varias).
5. Agrega los servicios con **Agregar del catálogo…** o **Concepto libre** si es
   algo puntual. Ajusta cantidad y precio si hace falta y revisa la casilla
   **IVA 16%** de cada línea.
6. Confirma la **tasa BCV aplicada** (viene prellenada con la tasa vigente).
7. Elige el **método de cobro**: verás subtotal, IVA, IGTF y **Total a pagar**
   en dólares y en bolívares.
8. Deja marcado **Registrar el cobro al emitir** si estás cobrando ahora y
   escribe la **referencia** (obligatoria en Pago Móvil, transferencia y Zelle).
9. Pulsa **Emitir factura**. Queda numerada, con su N° de control, y el cobro
   se registra como **Verificado** si confirmaste la referencia.

> **Tip:** si el paciente pagará después, desmarca la casilla del cobro y emite
> igualmente: la factura queda **Emitida** y podrás registrar el pago luego
> desde el detalle.

## 5. Estados que verás

**Estado de la factura**

| Estado | Significado |
| --- | --- |
| Borrador | Guardada sin numeración fiscal, editable por completo |
| Emitida | Con N° de factura y control; pendiente de cobro o abonada |
| Pagada | Cobrada en su totalidad |
| Anulada | Cancelada con nota de crédito |
| Reembolsada | Anulada y con devolución del dinero al paciente |

**Estado del cobro**

| Estado | Significado |
| --- | --- |
| Sin cobrar | No hay pagos confirmados |
| Abonada | Hay pagos parciales verificados |
| Cobrada | La suma de pagos iguala el total |

Solo los cobros **Verificados** cuentan como dinero recibido; los que quedan
**Por verificar** no afectan el saldo hasta que la recepción los confirme.

## 6. Cobrar una factura ya emitida

1. En **Facturación y cobros → Historial** busca la factura y pulsa
   **Ver detalle**.
2. En **Registrar cobro** elige el método, escribe el monto en USD (o el monto
   en bolívares) y la referencia.
3. Pulsa **Usar saldo** para cargar automáticamente lo que falta.
4. Deja marcado **Marcar como verificado** si ya confirmaste el pago.
5. **Guardar cobro**: el sistema recalcula IGTF, total y estado de cobro.

> **Nota:** no se puede cobrar un borrador. Emite la factura (con su N° de
> control) y luego registra el pago.

## 7. Notas de crédito y débito (anulaciones y ajustes)

En el detalle de la factura encontrarás **Notas de ajuste fiscal**.

- **Nota de crédito** — anula o ajusta a favor del paciente (consulta no
  realizada, error en el monto, devolución). Marca **Se devolvió el dinero al
  paciente (reembolso)** si además entregaste el efectivo: la factura quedará
  como **Reembolsada** en lugar de **Anulada**.
- **Nota de débito** — cobra algo adicional (por ejemplo, un insumo no
  previsto). Su monto se suma al total a pagar de la factura.

Reglas importantes:

1. El **motivo es obligatorio** y queda guardado en la nota (es auditoría).
2. Toda nota consume su **propia numeración y N° de control**.
3. Al anular, los cobros **por verificar** se rechazan automáticamente para que
   no distorsionen la caja.
4. Una factura anulada o reembolsada no admite nuevos cobros.

## 8. Problemas frecuentes

| Mensaje | Qué hacer |
| --- | --- |
| «El RIF debe tener el formato V-00000000-0» | Revisa la letra y los 9 dígitos; usa V, E, J o G |
| «Faltan datos fiscales del cliente» | Documento, razón social y dirección son obligatorios |
| «No se pudo asignar el Número de Control» | Contacta a soporte: falta aplicar la migración del módulo |
| «Emite la factura antes de registrar cobros» | Pasa el borrador a emitida |
| «La factura está anulada o reembolsada» | No admite cobros; emite una nueva si corresponde |
$md$
  ),
  (
    'libro-ventas-cierre-caja-honorarios',
    'Libro de Ventas SENIAT, cierre de caja y honorarios',
    'Gestión Fiscal y Administrativa (Venezuela)',
    3,
    $md$# Libro de Ventas SENIAT, cierre de caja y honorarios

Guía del bloque **Contabilidad y caja**: el reporte fiscal mensual, el arqueo
diario de la recepción y la liquidación de honorarios a los médicos.

> **Quién entra:** **Administrador**, **Contador** y **Recepción** (caja). Las
> liquidaciones de médicos solo las gestionan Administrador y Contador.

## 1. Libro de Ventas del SENIAT

El Libro de Ventas es el reporte mensual obligatorio que resume tus
operaciones. Medisys lo genera con el formato de la providencia, incluyendo:

- Fecha, tipo de documento, RIF/Cédula y nombre del cliente.
- N° de factura, N° de control y N° de nota de crédito/débito.
- Total de ventas incluyendo IVA, ventas no gravadas/exentas y base imponible.
- Alícuota aplicada, **IVA debitado** y **monto de IGTF percibido**.
- Cada importe se muestra en dólares **y** en bolívares, con la tasa vigente al
  momento de cada factura.

### Cómo descargarlo

1. Ve a **Contabilidad y caja → Libro de Ventas SENIAT**.
2. Elige **Año**, **Mes** y, si aplica, la **Sede**.
3. Pulsa **Generar libro**. Arriba verás el resumen del mes (facturado, exentas,
   base imponible, IVA e IGTF) y abajo la tabla con cada operación.
4. Pulsa **Descargar CSV**. El archivo se guarda como
   `libro-ventas-AAAA-MM.csv`, con acentos correctos y una fila de **TOTALES**
   al final, listo para Excel o para el archivo fiscal del contador.
5. Pulsa **Imprimir** si necesitas una copia en papel.

**Cómo leer el reporte**

| Columna | Qué incluye |
| --- | --- |
| Total ventas incl. IVA | Ventas vigentes menos notas de crédito más notas de débito |
| Ventas no gravadas / exentas | Servicios médicos exentos (los más habituales) |
| Base imponible | Servicios gravados sobre los que se calculó el 16% |
| IVA debitado | Impuesto a enterar por las ventas gravadas |
| IGTF percibido | 3% cobrado en pagos en divisas |

> **Nota:** el IGTF va en una columna aparte porque no forma parte de la base
> del IVA: grava el medio de pago. Las facturas anuladas o reembolsadas
> aparecen atenuadas con su nota, para dejar rastro de auditoría.

## 2. Cierre y arqueo de caja (recepción)

El arqueo compara **lo que el sistema espera** (cobros verificados del día)
contra **lo que hay físicamente** en caja.

### Paso a paso

1. Ve a **Contabilidad y caja → Cierre y arqueo de caja**.
2. Verifica la **fecha** (por defecto, hoy) y elige la **sede / caja**.
3. Pulsa **Calcular sistema** para traer los cobros del día. Por cada método
   verás el **Esperado USD** y **Esperado Bs.** (base + IGTF cobrado) y cuántas
   **operaciones** del sistema respaldan ese monto.
4. Cuenta el dinero real y escríbelo en **Contado USD** y **Contado Bs.** de
   cada método (Pago Móvil, transferencia, punto de venta, efectivo Bs.,
   Zelle, efectivo USD).
5. Revisa el **descalce** de la última columna y los totales de arriba:

| Resultado | Significado | Qué hacer |
| --- | --- | --- |
| Cuadrado | Coincide con el sistema | Cerrar la caja |
| Faltante | Hay menos dinero del esperado | Revisar comprobantes y escribir la nota |
| Sobrante | Hay más dinero del esperado | Verificar cobros sin registrar y anotar |

6. Escribe una **nota del arqueo** si hay diferencias (por ejemplo, «faltante de
   Bs. 7,55 en Pago Móvil: referencia duplicada, se corrige mañana»).
7. Pulsa **Guardar avance** si aún estás contando, o **Cerrar caja del día**
   para finalizar la jornada.

### Después del cierre

- El arqueo queda en el **histórico** con su estado: **Abierto**, **Cerrado** o
  **Auditado**.
- **Cargar conteo guardado** rellena el formulario con el último conteo
  registrado para esa fecha y sede: útil para continuar un arqueo a medias.
- El Administrador o el Contador pueden pulsar **Auditar** para revisar y
  bloquear el cierre. Una vez auditado, ya no se puede modificar.

> **Recomendación:** cierra la caja al final de cada jornada, antes de que el
> personal rote. Si trabajas con varias sedes, cada caja hace su propio arqueo.

## 3. Honorarios médicos (administración)

La liquidación reúne los servicios facturados **y cobrados** de un médico en un
período y aplica el honorario pactado en el catálogo.

### Cómo se calcula

| Concepto | Fórmula |
| --- | --- |
| Bruto facturado | Suma de los servicios del médico (sin IVA) en facturas cobradas |
| Comisión de la clínica | Bruto − honorarios del médico |
| **Neto a pagar** | Suma de los honorarios configurados en cada servicio |

### Paso a paso

1. Ve a **Contabilidad y caja → Honorarios médicos**.
2. Elige el **especialista** y el **período** (por defecto, el mes en curso).
3. Pulsa **Calcular honorarios** y revisa la vista previa: bruto, comisión,
   **neto a pagar** en dólares y bolívares, cantidad de servicios y facturas
   consideradas, y el detalle línea a línea.
4. Pulsa **Generar liquidación** (queda **Pendiente**) o **Generar y aprobar**
   (queda **Aprobada**).
5. Cuando pagues al médico, escribe la **referencia de pago** (transferencia,
   Pago Móvil o Zelle) y pulsa **Marcar pagada**.

**Estados de una liquidación**

| Estado | Significado |
| --- | --- |
| Pendiente | Calculada, esperando aprobación |
| Aprobada | Lista para pagar |
| Pagada | Con referencia de pago registrada |

> **Importante:** un mismo período no se puede liquidar dos veces para el mismo
> médico. Si quedaron servicios por cobrar, liquida el sobrante cuando se
> cobren o espera al siguiente período.

> **Tip:** si un médico reclama que un servicio no aparece, revisa primero que
> (1) la factura esté **Pagada** y (2) el servicio tenga el **honorario**
> configurado en el catálogo. Una factura solo abonada no entra en la
> liquidación.

## 4. Quién puede hacer qué

| Acción | Administrador | Contador | Recepción | Médico |
| --- | --- | --- | --- | --- |
| Ver el Libro de Ventas y exportarlo | ✔ | ✔ | ✔ | — |
| Calcular y cerrar caja | ✔ | ✔ | ✔ | — |
| Auditar un arqueo | ✔ | ✔ | — | — |
| Generar, aprobar y pagar honorarios | ✔ | ✔ | — | — |

## 5. Rutina sugerida

- **Diario (recepción):** revisar la tasa del día y cerrar la caja al terminar.
- **Semanal (administración):** revisar facturas emitidas sin cobrar.
- **Mensual (contador):** descargar el Libro de Ventas, cuadrar IVA e IGTF y
  liquidar honorarios; archivar el CSV con los soportes fiscales.
$md$
  )
on conflict (slug) do nothing;
