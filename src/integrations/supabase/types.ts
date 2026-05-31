export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      administrador: {
        Row: {
          criado_em: string
          email: string
          id: string
        }
        Insert: {
          criado_em?: string
          email: string
          id: string
        }
        Update: {
          criado_em?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      bairros: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
          taxa_entrega: number
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
          taxa_entrega?: number
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
          taxa_entrega?: number
        }
        Relationships: []
      }
      categorias: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          imagem_url: string | null
          nome: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          imagem_url?: string | null
          nome: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          imagem_url?: string | null
          nome?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          avatar_url: string | null
          criado_em: string
          email: string | null
          id: string
          nome: string | null
          telefone: string | null
        }
        Insert: {
          avatar_url?: string | null
          criado_em?: string
          email?: string | null
          id: string
          nome?: string | null
          telefone?: string | null
        }
        Update: {
          avatar_url?: string | null
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      configuracoes_loja: {
        Row: {
          atualizado_em: string | null
          bairro: string | null
          banner_url: string | null
          cidade: string | null
          descricao: string | null
          horario_funcionamento: string | null
          id: number
          logo_url: string | null
          nome_loja: string
          numero: string | null
          rua: string | null
          telefone: string | null
          valor_minimo_pedido: number | null
          whatsapp: string | null
        }
        Insert: {
          atualizado_em?: string | null
          bairro?: string | null
          banner_url?: string | null
          cidade?: string | null
          descricao?: string | null
          horario_funcionamento?: string | null
          id?: number
          logo_url?: string | null
          nome_loja?: string
          numero?: string | null
          rua?: string | null
          telefone?: string | null
          valor_minimo_pedido?: number | null
          whatsapp?: string | null
        }
        Update: {
          atualizado_em?: string | null
          bairro?: string | null
          banner_url?: string | null
          cidade?: string | null
          descricao?: string | null
          horario_funcionamento?: string | null
          id?: number
          logo_url?: string | null
          nome_loja?: string
          numero?: string | null
          rua?: string | null
          telefone?: string | null
          valor_minimo_pedido?: number | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      enderecos_cliente: {
        Row: {
          bairro_id: string | null
          cliente_id: string | null
          complemento: string | null
          criado_em: string
          id: string
          numero: string
          principal: boolean | null
          referencia: string | null
          rua: string
        }
        Insert: {
          bairro_id?: string | null
          cliente_id?: string | null
          complemento?: string | null
          criado_em?: string
          id?: string
          numero: string
          principal?: boolean | null
          referencia?: string | null
          rua: string
        }
        Update: {
          bairro_id?: string | null
          cliente_id?: string | null
          complemento?: string | null
          criado_em?: string
          id?: string
          numero?: string
          principal?: boolean | null
          referencia?: string | null
          rua?: string
        }
        Relationships: [
          {
            foreignKeyName: "enderecos_cliente_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enderecos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_pedido: {
        Row: {
          id: string
          pedido_id: string | null
          produto_id: string | null
          quantidade: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          id?: string
          pedido_id?: string | null
          produto_id?: string | null
          quantidade: number
          valor_total: number
          valor_unitario: number
        }
        Update: {
          id?: string
          pedido_id?: string | null
          produto_id?: string | null
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_pedido_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          bairro_id: string | null
          cliente_id: string | null
          complemento: string | null
          criado_em: string
          forma_pagamento: string
          id: string
          nome_cliente: string
          numero: string | null
          precisa_troco: boolean | null
          referencia: string | null
          rua: string | null
          status: string
          subtotal: number
          taxa_entrega: number
          telefone: string
          tipo_recebimento: string
          valor_total: number
          valor_troco: number | null
        }
        Insert: {
          bairro_id?: string | null
          cliente_id?: string | null
          complemento?: string | null
          criado_em?: string
          forma_pagamento: string
          id?: string
          nome_cliente: string
          numero?: string | null
          precisa_troco?: boolean | null
          referencia?: string | null
          rua?: string | null
          status?: string
          subtotal: number
          taxa_entrega: number
          telefone: string
          tipo_recebimento?: string
          valor_total: number
          valor_troco?: number | null
        }
        Update: {
          bairro_id?: string | null
          cliente_id?: string | null
          complemento?: string | null
          criado_em?: string
          forma_pagamento?: string
          id?: string
          nome_cliente?: string
          numero?: string | null
          precisa_troco?: boolean | null
          referencia?: string | null
          rua?: string | null
          status?: string
          subtotal?: number
          taxa_entrega?: number
          telefone?: string
          tipo_recebimento?: string
          valor_total?: number
          valor_troco?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          criado_em: string
          descricao: string | null
          estoque: number
          id: string
          imagem_url: string | null
          nome: string
          permite_fracionamento: boolean
          preco: number
          quantidade_minima: number | null
          unidade_venda: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          criado_em?: string
          descricao?: string | null
          estoque?: number
          id?: string
          imagem_url?: string | null
          nome: string
          permite_fracionamento?: boolean
          preco: number
          quantidade_minima?: number | null
          unidade_venda: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          criado_em?: string
          descricao?: string | null
          estoque?: number
          id?: string
          imagem_url?: string | null
          nome?: string
          permite_fracionamento?: boolean
          preco?: number
          quantidade_minima?: number | null
          unidade_venda?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
