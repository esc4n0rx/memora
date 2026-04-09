'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function AboutView() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Memora</h1>
          <p className="text-xl text-muted-foreground">
            Organize seu conhecimento de forma inteligente
          </p>
        </div>

        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Sobre o Memora</h2>
          <div className="space-y-4 text-sm leading-relaxed">
            <p>
              Memora é uma ferramenta de produtividade desenvolvida especialmente para consultores,
              desenvolvedores e profissionais que trabalham com sistemas complexos como SAP.
            </p>
            <p>
              Com o Memora, você pode criar notas ricas em markdown, desenhar fluxos e mapas mentais
              para visualizar processos, e organizar referências e comandos em blocos categorizados.
            </p>
            <p>
              Tudo é salvo localmente no seu navegador, garantindo privacidade e acesso rápido
              mesmo offline.
            </p>
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Recursos</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2" />
              <div>
                <div className="font-medium text-sm">Notas com Markdown</div>
                <p className="text-xs text-muted-foreground">
                  Editor rico com suporte a formatação, tags e busca inteligente
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-accent rounded-full mt-2" />
              <div>
                <div className="font-medium text-sm">Mapas Mentais</div>
                <p className="text-xs text-muted-foreground">
                  Canvas livre para desenhar fluxos, processos e integrações
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2" />
              <div>
                <div className="font-medium text-sm">Organizador de Blocos</div>
                <p className="text-xs text-muted-foreground">
                  Organize transações SAP, comandos e referências por categoria
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-accent rounded-full mt-2" />
              <div>
                <div className="font-medium text-sm">100% Local</div>
                <p className="text-xs text-muted-foreground">
                  Seus dados ficam no seu navegador, sem backend ou servidor
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Informações Técnicas</h2>
            <Badge variant="secondary">v1.0.0</Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Versão:</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tecnologia:</span>
              <span className="font-medium">Next.js + React</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Armazenamento:</span>
              <span className="font-medium">LocalStorage</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Autor:</span>
              <span className="font-medium">Equipe Memora</span>
            </div>
          </div>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Feito com dedicação para profissionais que valorizam organização</p>
        </div>
      </div>
    </div>
  )
}
