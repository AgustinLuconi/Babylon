import sys
bien = mal = 0
for linea in sys.stdin:
    linea = linea.rstrip("\n")
    if " (esperado " not in linea:
        continue
    cuerpo, esperado = linea.rsplit(" (esperado ", 1)
    esperado = esperado[:-1]
    if cuerpo.endswith(": " + esperado):
        real = esperado
        etiqueta = cuerpo[: -len(esperado) - 2]
    else:
        etiqueta, _, real = cuerpo.rpartition(": ")
    if real == esperado:
        bien += 1
    else:
        mal += 1
        print(f"FALLA  {etiqueta}: {real} (esperado {esperado})")
print(f"{bien} bien, {mal} mal")
