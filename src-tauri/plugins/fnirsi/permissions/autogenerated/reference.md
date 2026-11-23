## Default Permission

Lectura del FNIRSI 2C53T por su enlace USB «stock-link»: buscar el instrumento, abrirlo, pedirle su identificación, suscribirse a sus medidas, leerlas y cerrarlo. Nada más: solo se abre el dispositivo USB 1209:0001 cuyo nombre es «2C53T stock-link», y solo se le envían las órdenes de identificación y de suscripción (nunca la de lectura de memoria).

#### This default permission set includes the following:

- `allow-listar`
- `allow-abrir`
- `allow-enviar`
- `allow-leer`
- `allow-cerrar`

## Permission Table

<table>
<tr>
<th>Identifier</th>
<th>Description</th>
</tr>


<tr>
<td>

`fnirsi:allow-abrir`

</td>
<td>

Enables the abrir command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`fnirsi:deny-abrir`

</td>
<td>

Denies the abrir command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`fnirsi:allow-cerrar`

</td>
<td>

Enables the cerrar command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`fnirsi:deny-cerrar`

</td>
<td>

Denies the cerrar command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`fnirsi:allow-enviar`

</td>
<td>

Enables the enviar command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`fnirsi:deny-enviar`

</td>
<td>

Denies the enviar command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`fnirsi:allow-leer`

</td>
<td>

Enables the leer command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`fnirsi:deny-leer`

</td>
<td>

Denies the leer command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`fnirsi:allow-listar`

</td>
<td>

Enables the listar command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`fnirsi:deny-listar`

</td>
<td>

Denies the listar command without any pre-configured scope.

</td>
</tr>
</table>
