## Default Permission

Lectura del Brymen BM869s por el cable BU-86X: buscar el cable, abrirlo, pedir y leer un paquete de la pantalla, y cerrarlo. Nada más: ningún otro dispositivo USB se abre (solo VID 0x0820, PID 0x0001).

#### This default permission set includes the following:

- `allow-listar`
- `allow-abrir`
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

`brymen:allow-abrir`

</td>
<td>

Enables the abrir command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`brymen:deny-abrir`

</td>
<td>

Denies the abrir command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`brymen:allow-cerrar`

</td>
<td>

Enables the cerrar command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`brymen:deny-cerrar`

</td>
<td>

Denies the cerrar command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`brymen:allow-leer`

</td>
<td>

Enables the leer command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`brymen:deny-leer`

</td>
<td>

Denies the leer command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`brymen:allow-listar`

</td>
<td>

Enables the listar command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`brymen:deny-listar`

</td>
<td>

Denies the listar command without any pre-configured scope.

</td>
</tr>
</table>
