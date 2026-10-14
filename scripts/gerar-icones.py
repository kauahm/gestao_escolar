# Gera os ícones do sistema (aba do navegador e tela inicial do celular).
# Rodar:  python scripts/gerar-icones.py   (precisa do Pillow: pip install pillow)
#
# Desenho: quadrado azul da marca (#185FA5) com uma escola estilizada em branco
# (telhado, prédio, porta e janelas). Simples de propósito, para ficar nítido
# em 16 px e em 512 px.
import pathlib

from PIL import Image, ImageDraw

AZUL = (24, 95, 165, 255)
BRANCO = (255, 255, 255, 255)
PASTA = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'icones'
PASTA.mkdir(parents=True, exist_ok=True)
GRANDE = 1024  # desenha grande e reduz, para as bordas ficarem suaves


def escola(d, cx, cy, escala):
    """Escola centrada em (cx, cy); escala = largura total do desenho."""
    w = escala
    meia = w / 2
    # telhado
    d.polygon([(cx - meia, cy - w * 0.05), (cx, cy - w * 0.45), (cx + meia, cy - w * 0.05)], fill=BRANCO)
    # prédio
    d.rectangle([cx - w * 0.38, cy - w * 0.08, cx + w * 0.38, cy + w * 0.42], fill=BRANCO)
    # porta (vazada)
    d.rounded_rectangle([cx - w * 0.09, cy + w * 0.14, cx + w * 0.09, cy + w * 0.42], radius=w * 0.04, fill=AZUL)
    # janelas
    for dx in (-0.26, 0.17):
        d.rectangle([cx + w * dx, cy + w * 0.03, cx + w * (dx + 0.09), cy + w * 0.12], fill=AZUL)
    # janela redonda do telhado
    r = w * 0.06
    d.ellipse([cx - r, cy - w * 0.25 - r, cx + r, cy - w * 0.25 + r], fill=AZUL)


def icone(tamanho, arredondado=True, area_util=0.62):
    img = Image.new('RGBA', (GRANDE, GRANDE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if arredondado:
        d.rounded_rectangle([0, 0, GRANDE - 1, GRANDE - 1], radius=GRANDE * 0.22, fill=AZUL)
    else:
        d.rectangle([0, 0, GRANDE, GRANDE], fill=AZUL)
    escola(d, GRANDE / 2, GRANDE * 0.53, GRANDE * area_util)
    return img.resize((tamanho, tamanho), Image.LANCZOS)


icone(32).save(PASTA / 'favicon-32.png')
icone(192).save(PASTA / 'icone-192.png')
icone(512).save(PASTA / 'icone-512.png')
# "maskable": o Android recorta em círculo/formatos; o desenho fica na área segura (80%).
icone(512, arredondado=False, area_util=0.50).save(PASTA / 'icone-maskable-512.png')
# iPhone: quadrado cheio (o próprio iOS arredonda os cantos).
icone(180, arredondado=False, area_util=0.58).convert('RGB').save(PASTA / 'apple-touch-icon.png')
print('ícones gerados em', PASTA)
