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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      cardapioweb_integrations: {
        Row: {
          api_token: string
          auto_accept: boolean
          auto_kds: boolean
          auto_print: boolean
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          store_id: string | null
          tenant_id: string
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          api_token: string
          auto_accept?: boolean
          auto_kds?: boolean
          auto_print?: boolean
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          store_id?: string | null
          tenant_id: string
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          api_token?: string
          auto_accept?: boolean
          auto_kds?: boolean
          auto_print?: boolean
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          store_id?: string | null
          tenant_id?: string
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cardapioweb_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cardapioweb_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          external_order_id: string | null
          id: string
          payload: Json | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          external_order_id?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          external_order_id?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cardapioweb_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cardapioweb_product_mappings: {
        Row: {
          cardapioweb_item_id: number
          cardapioweb_item_name: string
          created_at: string | null
          id: string
          local_product_id: string | null
          local_variation_id: string | null
          tenant_id: string
        }
        Insert: {
          cardapioweb_item_id: number
          cardapioweb_item_name: string
          created_at?: string | null
          id?: string
          local_product_id?: string | null
          local_variation_id?: string | null
          tenant_id: string
        }
        Update: {
          cardapioweb_item_id?: number
          cardapioweb_item_name?: string
          created_at?: string | null
          id?: string
          local_product_id?: string | null
          local_variation_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cardapioweb_product_mappings_local_product_id_fkey"
            columns: ["local_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cardapioweb_product_mappings_local_variation_id_fkey"
            columns: ["local_variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cardapioweb_product_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cardapioweb_webhook_queue: {
        Row: {
          error_message: string | null
          event_type: string
          external_order_id: string | null
          headers: Json | null
          id: string
          lock_until: string
          merchant_id: string
          order_status: string | null
          payload: Json
          processed_at: string | null
          received_at: string
          retries: number
          status: string
          tenant_id: string | null
        }
        Insert: {
          error_message?: string | null
          event_type: string
          external_order_id?: string | null
          headers?: Json | null
          id?: string
          lock_until?: string
          merchant_id: string
          order_status?: string | null
          payload: Json
          processed_at?: string | null
          received_at?: string
          retries?: number
          status?: string
          tenant_id?: string | null
        }
        Update: {
          error_message?: string | null
          event_type?: string
          external_order_id?: string | null
          headers?: Json | null
          id?: string
          lock_until?: string
          merchant_id?: string
          order_status?: string | null
          payload?: Json
          processed_at?: string | null
          received_at?: string
          retries?: number
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cardapioweb_webhook_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          cash_register_id: string
          created_at: string | null
          created_by: string | null
          id: string
          movement_type: string
          reason: string | null
          tenant_id: string | null
        }
        Insert: {
          amount: number
          cash_register_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: string
          reason?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          cash_register_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: string
          reason?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          difference: number | null
          expected_amount: number | null
          id: string
          opened_at: string | null
          opened_by: string
          opening_amount: number
          status: Database["public"]["Enums"]["cash_register_status"] | null
          tenant_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          opened_at?: string | null
          opened_by: string
          opening_amount?: number
          status?: Database["public"]["Enums"]["cash_register_status"] | null
          tenant_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          opened_at?: string | null
          opened_by?: string
          opening_amount?: number
          status?: Database["public"]["Enums"]["cash_register_status"] | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          allowed_times: Json
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          tenant_id: string | null
        }
        Insert: {
          allowed_times?: Json
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          tenant_id?: string | null
        }
        Update: {
          allowed_times?: Json
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_items: {
        Row: {
          combo_id: string
          id: string
          product_id: string
          quantity: number | null
          tenant_id: string | null
          variation_id: string | null
        }
        Insert: {
          combo_id: string
          id?: string
          product_id: string
          quantity?: number | null
          tenant_id?: string | null
          variation_id?: string | null
        }
        Update: {
          combo_id?: string
          id?: string
          product_id?: string
          quantity?: number | null
          tenant_id?: string | null
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          combo_price: number
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          original_price: number
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          combo_price?: number
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          original_price?: number
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          combo_price?: number
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          original_price?: number
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      complement_group_options: {
        Row: {
          badge: string | null
          created_at: string | null
          group_id: string
          id: string
          max_quantity: number | null
          option_id: string
          price_override: number | null
          sort_order: number | null
          tenant_id: string | null
        }
        Insert: {
          badge?: string | null
          created_at?: string | null
          group_id: string
          id?: string
          max_quantity?: number | null
          option_id: string
          price_override?: number | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Update: {
          badge?: string | null
          created_at?: string | null
          group_id?: string
          id?: string
          max_quantity?: number | null
          option_id?: string
          price_override?: number | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complement_group_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "complement_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complement_group_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "complement_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complement_group_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      complement_groups: {
        Row: {
          applicable_flavor_counts: number[]
          applies_per_unit: boolean | null
          channels: string[] | null
          created_at: string | null
          description: string | null
          flavor_modal_channels: string[]
          flavor_modal_enabled: boolean
          flavor_options: Json
          id: string
          is_active: boolean | null
          is_required: boolean | null
          kds_category: string
          max_selections: number | null
          min_selections: number | null
          name: string
          price_calculation_type: string | null
          selection_type: string
          sort_order: number | null
          tenant_id: string | null
          unit_count: number | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          applicable_flavor_counts?: number[]
          applies_per_unit?: boolean | null
          channels?: string[] | null
          created_at?: string | null
          description?: string | null
          flavor_modal_channels?: string[]
          flavor_modal_enabled?: boolean
          flavor_options?: Json
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          kds_category?: string
          max_selections?: number | null
          min_selections?: number | null
          name: string
          price_calculation_type?: string | null
          selection_type?: string
          sort_order?: number | null
          tenant_id?: string | null
          unit_count?: number | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          applicable_flavor_counts?: number[]
          applies_per_unit?: boolean | null
          channels?: string[] | null
          created_at?: string | null
          description?: string | null
          flavor_modal_channels?: string[]
          flavor_modal_enabled?: boolean
          flavor_options?: Json
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          kds_category?: string
          max_selections?: number | null
          min_selections?: number | null
          name?: string
          price_calculation_type?: string | null
          selection_type?: string
          sort_order?: number | null
          tenant_id?: string | null
          unit_count?: number | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complement_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      complement_option_ingredients: {
        Row: {
          complement_option_id: string
          created_at: string | null
          id: string
          ingredient_id: string
          quantity: number
          tenant_id: string
        }
        Insert: {
          complement_option_id: string
          created_at?: string | null
          id?: string
          ingredient_id: string
          quantity?: number
          tenant_id: string
        }
        Update: {
          complement_option_id?: string
          created_at?: string | null
          id?: string
          ingredient_id?: string
          quantity?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complement_option_ingredients_complement_option_id_fkey"
            columns: ["complement_option_id"]
            isOneToOne: false
            referencedRelation: "complement_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complement_option_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complement_option_ingredients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      complement_option_recipes: {
        Row: {
          complement_option_id: string
          created_at: string | null
          id: string
          quantity_multiplier: number
          recipe_id: string
          tenant_id: string | null
        }
        Insert: {
          complement_option_id: string
          created_at?: string | null
          id?: string
          quantity_multiplier?: number
          recipe_id: string
          tenant_id?: string | null
        }
        Update: {
          complement_option_id?: string
          created_at?: string | null
          id?: string
          quantity_multiplier?: number
          recipe_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complement_option_recipes_complement_option_id_fkey"
            columns: ["complement_option_id"]
            isOneToOne: false
            referencedRelation: "complement_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complement_option_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complement_option_recipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      complement_options: {
        Row: {
          auto_calculate_cost: boolean | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          enable_stock_control: boolean | null
          external_code: string | null
          id: string
          ifood_code: string | null
          image_url: string | null
          internal_code: string | null
          is_active: boolean | null
          name: string
          pdv_code: string | null
          price: number
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_calculate_cost?: boolean | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          enable_stock_control?: boolean | null
          external_code?: string | null
          id?: string
          ifood_code?: string | null
          image_url?: string | null
          internal_code?: string | null
          is_active?: boolean | null
          name: string
          pdv_code?: string | null
          price?: number
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_calculate_cost?: boolean | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          enable_stock_control?: boolean | null
          external_code?: string | null
          id?: string
          ifood_code?: string | null
          image_url?: string | null
          internal_code?: string | null
          is_active?: boolean | null
          name?: string
          pdv_code?: string | null
          price?: number
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complement_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_allowances: {
        Row: {
          amount: number
          courier_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          payment_transaction_id: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          courier_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          payment_transaction_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          courier_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          payment_transaction_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_allowances_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_allowances_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_allowances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_locations: {
        Row: {
          accuracy: number | null
          courier_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string | null
          speed: number | null
          tenant_id: string
        }
        Insert: {
          accuracy?: number | null
          courier_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string | null
          speed?: number | null
          tenant_id: string
        }
        Update: {
          accuracy?: number | null
          courier_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string | null
          speed?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_locations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_wallets: {
        Row: {
          available: number
          courier_id: string
          id: string
          locked: number
          pending: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          available?: number
          courier_id: string
          id?: string
          locked?: number
          pending?: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          available?: number
          courier_id?: string
          id?: string
          locked?: number
          pending?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_wallets_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: true
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_wallets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          created_at: string | null
          document: string | null
          id: string
          is_active: boolean | null
          is_available: boolean | null
          name: string
          phone: string | null
          photo_url: string | null
          pix_key: string | null
          pix_key_type: string | null
          tenant_id: string
          updated_at: string | null
          user_id: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string | null
          document?: string | null
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          name: string
          phone?: string | null
          photo_url?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          tenant_id: string
          updated_at?: string | null
          user_id?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string | null
          document?: string | null
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          name?: string
          phone?: string | null
          photo_url?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couriers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_sounds: {
        Row: {
          created_at: string | null
          file_path: string
          id: string
          name: string
          sound_type: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_path: string
          id?: string
          name: string
          sound_type: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_path?: string
          id?: string
          name?: string
          sound_type?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_sounds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          birthday: string | null
          created_at: string | null
          id: string
          last_order_at: string | null
          name: string
          notes: string | null
          phone: string | null
          tenant_id: string | null
          total_orders: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          birthday?: string | null
          created_at?: string | null
          id?: string
          last_order_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          birthday?: string | null
          created_at?: string | null
          id?: string
          last_order_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          courier_id: string
          created_at: string | null
          created_by: string | null
          id: string
          order_id: string | null
          reason: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          adjustment_type?: string
          amount: number
          courier_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          order_id?: string | null
          reason?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          adjustment_type?: string
          amount?: number
          courier_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          order_id?: string | null
          reason?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_adjustments_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_adjustments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_fee_tiers: {
        Row: {
          created_at: string | null
          fee: number
          id: string
          is_active: boolean | null
          max_distance_km: number
          min_distance_km: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fee?: number
          id?: string
          is_active?: boolean | null
          max_distance_km: number
          min_distance_km?: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fee?: number
          id?: string
          is_active?: boolean | null
          max_distance_km?: number
          min_distance_km?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_fee_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_logistics_groups: {
        Row: {
          created_at: string
          estimated_route_km: number | null
          id: string
          released_at: string | null
          status: string
          strategy: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          estimated_route_km?: number | null
          id?: string
          released_at?: string | null
          status?: string
          strategy?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          estimated_route_km?: number | null
          id?: string
          released_at?: string | null
          status?: string
          strategy?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_logistics_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_retry_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          next_retry_at: string
          order_id: string
          status: string
          tenant_id: string
          webhook_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string
          order_id: string
          status?: string
          tenant_id: string
          webhook_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string
          order_id?: string
          status?: string
          tenant_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_retry_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_retry_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_retry_queue_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "order_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_offers: {
        Row: {
          courier_id: string
          created_at: string | null
          delivery_fee: number | null
          estimated_distance_km: number | null
          estimated_duration_minutes: number | null
          expires_at: string
          id: string
          offered_at: string | null
          order_id: string
          rejection_reason: string | null
          responded_at: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          courier_id: string
          created_at?: string | null
          delivery_fee?: number | null
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          expires_at: string
          id?: string
          offered_at?: string | null
          order_id: string
          rejection_reason?: string | null
          responded_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          courier_id?: string
          created_at?: string | null
          delivery_fee?: number | null
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          expires_at?: string
          id?: string
          offered_at?: string | null
          order_id?: string
          rejection_reason?: string | null
          responded_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_offers_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_offers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_offers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dp_api_clients: {
        Row: {
          client_id: string
          client_name: string
          client_secret: string
          created_at: string | null
          id: string
          is_active: boolean | null
          scopes: string[] | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          client_id?: string
          client_name: string
          client_secret?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          scopes?: string[] | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          client_name?: string
          client_secret?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          scopes?: string[] | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dp_api_clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dp_app_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          tenant_id: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          tenant_id: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          tenant_id?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dp_app_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      global_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          tenant_id: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          tenant_id?: string | null
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          tenant_id?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "global_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_daily_targets: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          ingredient_id: string
          target_quantity: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          ingredient_id: string
          target_quantity?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          ingredient_id?: string
          target_quantity?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_daily_targets_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_daily_targets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          cost_per_unit: number | null
          created_at: string | null
          current_stock: number | null
          id: string
          ingredient_type: string
          is_insumo: boolean
          min_stock: number | null
          name: string
          tenant_id: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          cost_per_unit?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          ingredient_type?: string
          is_insumo?: boolean
          min_stock?: number | null
          name: string
          tenant_id?: string | null
          unit: string
          updated_at?: string | null
        }
        Update: {
          cost_per_unit?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          ingredient_type?: string
          is_insumo?: boolean
          min_stock?: number | null
          name?: string
          tenant_id?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kds_devices: {
        Row: {
          auth_code: string | null
          created_at: string | null
          device_id: string
          id: string
          is_active: boolean | null
          last_seen_at: string | null
          name: string
          operation_mode: string | null
          password_hash: string | null
          station_id: string | null
          tenant_id: string | null
          username: string | null
          verification_code: string | null
        }
        Insert: {
          auth_code?: string | null
          created_at?: string | null
          device_id: string
          id?: string
          is_active?: boolean | null
          last_seen_at?: string | null
          name: string
          operation_mode?: string | null
          password_hash?: string | null
          station_id?: string | null
          tenant_id?: string | null
          username?: string | null
          verification_code?: string | null
        }
        Update: {
          auth_code?: string | null
          created_at?: string | null
          device_id?: string
          id?: string
          is_active?: boolean | null
          last_seen_at?: string | null
          name?: string
          operation_mode?: string | null
          password_hash?: string | null
          station_id?: string | null
          tenant_id?: string | null
          username?: string | null
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kds_devices_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "kds_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kds_global_settings: {
        Row: {
          auto_print_cancellations: boolean
          border_badge_color: string
          border_keywords: string[]
          bottleneck_settings: Json
          cancellation_alert_interval: number
          cancellation_alerts_enabled: boolean
          column_name_delivered: string
          column_name_pending: string
          column_name_preparing: string
          column_name_ready: string
          compact_mode: boolean
          created_at: string
          dark_mode: boolean
          delay_alert_enabled: boolean
          delay_alert_minutes: number
          hide_flavor_category_kds: boolean
          highlight_special_borders: boolean
          id: string
          kanban_visible_columns: string[]
          notes_badge_color: string
          notes_blink_all_stations: boolean
          operation_mode: string
          order_management_view_mode: string
          routing_mode: string
          show_party_size: boolean
          show_pending_column: boolean
          show_waiter_name: boolean
          sla_green_minutes: number
          sla_yellow_minutes: number
          tenant_id: string | null
          timer_green_minutes: number
          timer_yellow_minutes: number
          updated_at: string
        }
        Insert: {
          auto_print_cancellations?: boolean
          border_badge_color?: string
          border_keywords?: string[]
          bottleneck_settings?: Json
          cancellation_alert_interval?: number
          cancellation_alerts_enabled?: boolean
          column_name_delivered?: string
          column_name_pending?: string
          column_name_preparing?: string
          column_name_ready?: string
          compact_mode?: boolean
          created_at?: string
          dark_mode?: boolean
          delay_alert_enabled?: boolean
          delay_alert_minutes?: number
          hide_flavor_category_kds?: boolean
          highlight_special_borders?: boolean
          id?: string
          kanban_visible_columns?: string[]
          notes_badge_color?: string
          notes_blink_all_stations?: boolean
          operation_mode?: string
          order_management_view_mode?: string
          routing_mode?: string
          show_party_size?: boolean
          show_pending_column?: boolean
          show_waiter_name?: boolean
          sla_green_minutes?: number
          sla_yellow_minutes?: number
          tenant_id?: string | null
          timer_green_minutes?: number
          timer_yellow_minutes?: number
          updated_at?: string
        }
        Update: {
          auto_print_cancellations?: boolean
          border_badge_color?: string
          border_keywords?: string[]
          bottleneck_settings?: Json
          cancellation_alert_interval?: number
          cancellation_alerts_enabled?: boolean
          column_name_delivered?: string
          column_name_pending?: string
          column_name_preparing?: string
          column_name_ready?: string
          compact_mode?: boolean
          created_at?: string
          dark_mode?: boolean
          delay_alert_enabled?: boolean
          delay_alert_minutes?: number
          hide_flavor_category_kds?: boolean
          highlight_special_borders?: boolean
          id?: string
          kanban_visible_columns?: string[]
          notes_badge_color?: string
          notes_blink_all_stations?: boolean
          operation_mode?: string
          order_management_view_mode?: string
          routing_mode?: string
          show_party_size?: boolean
          show_pending_column?: boolean
          show_waiter_name?: boolean
          sla_green_minutes?: number
          sla_yellow_minutes?: number
          tenant_id?: string | null
          timer_green_minutes?: number
          timer_yellow_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kds_global_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kds_station_logs: {
        Row: {
          action: string
          created_at: string | null
          duration_seconds: number | null
          id: string
          notes: string | null
          order_item_id: string
          performed_by: string | null
          station_id: string
          tenant_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          order_item_id: string
          performed_by?: string | null
          station_id: string
          tenant_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          order_item_id?: string
          performed_by?: string | null
          station_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kds_station_logs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_station_logs_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "kds_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_station_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kds_stations: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          displayed_item_kinds: string[]
          icon: string | null
          id: string
          is_active: boolean | null
          is_edge_sector: boolean
          name: string
          oven_time_minutes: number
          sort_order: number | null
          station_type: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          displayed_item_kinds?: string[]
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_edge_sector?: boolean
          name: string
          oven_time_minutes?: number
          sort_order?: number | null
          station_type?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          displayed_item_kinds?: string[]
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_edge_sector?: boolean
          name?: string
          oven_time_minutes?: number
          sort_order?: number | null
          station_type?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kds_stations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_cancellations: {
        Row: {
          cancellation_reason: string
          cancelled_at: string
          cancelled_by: string | null
          customer_name: string | null
          id: string
          order_id: string
          order_item_id: string
          order_type: string | null
          product_name: string
          quantity: number
          table_id: string | null
          table_number: number | null
          tenant_id: string | null
          total_price: number
          unit_price: number
          variation_name: string | null
        }
        Insert: {
          cancellation_reason: string
          cancelled_at?: string
          cancelled_by?: string | null
          customer_name?: string | null
          id?: string
          order_id: string
          order_item_id: string
          order_type?: string | null
          product_name: string
          quantity: number
          table_id?: string | null
          table_number?: number | null
          tenant_id?: string | null
          total_price: number
          unit_price: number
          variation_name?: string | null
        }
        Update: {
          cancellation_reason?: string
          cancelled_at?: string
          cancelled_by?: string | null
          customer_name?: string | null
          id?: string
          order_id?: string
          order_item_id?: string
          order_type?: string | null
          product_name?: string
          quantity?: number
          table_id?: string | null
          table_number?: number | null
          tenant_id?: string | null
          total_price?: number
          unit_price?: number
          variation_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_cancellations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_cancellations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_cancellations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_extras: {
        Row: {
          external_group_id: string | null
          external_option_id: string | null
          extra_id: string | null
          extra_name: string
          id: string
          kds_category: string
          order_item_id: string
          price: number
          quantity: number | null
          tenant_id: string | null
        }
        Insert: {
          external_group_id?: string | null
          external_option_id?: string | null
          extra_id?: string | null
          extra_name: string
          id?: string
          kds_category?: string
          order_item_id: string
          price: number
          quantity?: number | null
          tenant_id?: string | null
        }
        Update: {
          external_group_id?: string | null
          external_option_id?: string | null
          extra_id?: string | null
          extra_name?: string
          id?: string
          kds_category?: string
          order_item_id?: string
          price?: number
          quantity?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_extras_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_extras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_sub_item_extras: {
        Row: {
          created_at: string | null
          group_id: string | null
          group_name: string
          id: string
          kds_category: string
          option_id: string | null
          option_name: string
          price: number
          quantity: number
          sub_item_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          group_id?: string | null
          group_name: string
          id?: string
          kds_category?: string
          option_id?: string | null
          option_name: string
          price?: number
          quantity?: number
          sub_item_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string | null
          group_name?: string
          id?: string
          kds_category?: string
          option_id?: string | null
          option_name?: string
          price?: number
          quantity?: number
          sub_item_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_sub_item_extras_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "complement_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_sub_item_extras_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "complement_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_sub_item_extras_sub_item_id_fkey"
            columns: ["sub_item_id"]
            isOneToOne: false
            referencedRelation: "order_item_sub_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_sub_item_extras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_sub_items: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_item_id: string
          sub_item_index: number
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_item_id: string
          sub_item_index: number
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_item_id?: string
          sub_item_index?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_sub_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_sub_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          added_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string | null
          current_station_id: string | null
          estimated_exit_at: string | null
          external_code: string | null
          external_item_id: string | null
          fulfillment_type: string | null
          has_edge: boolean
          id: string
          item_kind: string | null
          next_sector_id: string | null
          notes: string | null
          order_id: string
          oven_entry_at: string | null
          product_id: string | null
          product_name: string | null
          quantity: number
          ready_at: string | null
          served_at: string | null
          station_completed_at: string | null
          station_started_at: string | null
          station_status: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          tenant_id: string | null
          total_price: number
          unit_price: number
          variation_id: string | null
        }
        Insert: {
          added_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          current_station_id?: string | null
          estimated_exit_at?: string | null
          external_code?: string | null
          external_item_id?: string | null
          fulfillment_type?: string | null
          has_edge?: boolean
          id?: string
          item_kind?: string | null
          next_sector_id?: string | null
          notes?: string | null
          order_id: string
          oven_entry_at?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          ready_at?: string | null
          served_at?: string | null
          station_completed_at?: string | null
          station_started_at?: string | null
          station_status?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tenant_id?: string | null
          total_price: number
          unit_price: number
          variation_id?: string | null
        }
        Update: {
          added_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          current_station_id?: string | null
          estimated_exit_at?: string | null
          external_code?: string | null
          external_item_id?: string | null
          fulfillment_type?: string | null
          has_edge?: boolean
          id?: string
          item_kind?: string | null
          next_sector_id?: string | null
          notes?: string | null
          order_id?: string
          oven_entry_at?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          ready_at?: string | null
          served_at?: string | null
          station_completed_at?: string | null
          station_started_at?: string | null
          station_status?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tenant_id?: string | null
          total_price?: number
          unit_price?: number
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_current_station_id_fkey"
            columns: ["current_station_id"]
            isOneToOne: false
            referencedRelation: "kds_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_next_sector_id_fkey"
            columns: ["next_sector_id"]
            isOneToOne: false
            referencedRelation: "kds_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_reopens: {
        Row: {
          customer_name: string | null
          id: string
          new_status: string
          order_id: string
          order_type: string | null
          previous_status: string
          reason: string | null
          reopened_at: string
          reopened_by: string | null
          table_id: string | null
          tenant_id: string | null
          total_value: number | null
        }
        Insert: {
          customer_name?: string | null
          id?: string
          new_status: string
          order_id: string
          order_type?: string | null
          previous_status: string
          reason?: string | null
          reopened_at?: string
          reopened_by?: string | null
          table_id?: string | null
          tenant_id?: string | null
          total_value?: number | null
        }
        Update: {
          customer_name?: string | null
          id?: string
          new_status?: string
          order_id?: string
          order_type?: string | null
          previous_status?: string
          reason?: string | null
          reopened_at?: string
          reopened_by?: string | null
          table_id?: string | null
          tenant_id?: string | null
          total_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_reopens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_reopens_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_reopens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_webhook_logs: {
        Row: {
          attempted_at: string | null
          created_at: string
          dispatch_status: string
          duration_ms: number | null
          error_message: string | null
          event: string
          id: string
          identifier: string | null
          order_id: string | null
          request_body: Json | null
          request_headers: Json | null
          request_url: string
          response_body: string | null
          response_status: number | null
          skip_reason: string | null
          success: boolean
          tenant_id: string
          webhook_id: string
        }
        Insert: {
          attempted_at?: string | null
          created_at?: string
          dispatch_status?: string
          duration_ms?: number | null
          error_message?: string | null
          event: string
          id?: string
          identifier?: string | null
          order_id?: string | null
          request_body?: Json | null
          request_headers?: Json | null
          request_url: string
          response_body?: string | null
          response_status?: number | null
          skip_reason?: string | null
          success?: boolean
          tenant_id: string
          webhook_id: string
        }
        Update: {
          attempted_at?: string | null
          created_at?: string
          dispatch_status?: string
          duration_ms?: number | null
          error_message?: string | null
          event?: string
          id?: string
          identifier?: string | null
          order_id?: string | null
          request_body?: Json | null
          request_headers?: Json | null
          request_url?: string
          response_body?: string | null
          response_status?: number | null
          skip_reason?: string | null
          success?: boolean
          tenant_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_webhook_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_webhook_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "order_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      order_webhooks: {
        Row: {
          api_url: string | null
          auth_url: string | null
          auto_send: boolean
          callback_token: string
          client_id: string | null
          client_secret: string | null
          created_at: string
          created_by: string | null
          events: string[]
          external_store_id: string | null
          failure_count: number | null
          headers: Json | null
          id: string
          identifier: string
          is_active: boolean
          is_paused: boolean | null
          last_failure_at: string | null
          last_success_at: string | null
          name: string
          order_types: string[]
          pause_reason: string | null
          secret: string | null
          status: string | null
          tenant_id: string
          updated_at: string
          url: string
        }
        Insert: {
          api_url?: string | null
          auth_url?: string | null
          auto_send?: boolean
          callback_token?: string
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          created_by?: string | null
          events?: string[]
          external_store_id?: string | null
          failure_count?: number | null
          headers?: Json | null
          id?: string
          identifier: string
          is_active?: boolean
          is_paused?: boolean | null
          last_failure_at?: string | null
          last_success_at?: string | null
          name: string
          order_types?: string[]
          pause_reason?: string | null
          secret?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string
          url: string
        }
        Update: {
          api_url?: string | null
          auth_url?: string | null
          auto_send?: boolean
          callback_token?: string
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          created_by?: string | null
          events?: string[]
          external_store_id?: string | null
          failure_count?: number | null
          headers?: Json | null
          id?: string
          identifier?: string
          is_active?: boolean
          is_paused?: boolean | null
          last_failure_at?: string | null
          last_success_at?: string | null
          name?: string
          order_types?: string[]
          pause_reason?: string | null
          secret?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_webhooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          additional_fee: number | null
          archived_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          change_for: number | null
          courier_id: string | null
          created_at: string | null
          created_by: string | null
          customer_address: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_neighborhood: string | null
          delivery_status: string | null
          discount: number | null
          dispatched_at: string | null
          external_customer_id: string | null
          external_delivery_id: string | null
          external_display_id: string | null
          external_order_id: string | null
          external_raw_payload: Json | null
          external_source: string | null
          fiscal_document: string | null
          geocode_status: string | null
          id: string
          integracao_logistica_log: string | null
          integracao_logistica_status: string | null
          is_draft: boolean | null
          logistics_group_id: string | null
          logistics_status: string | null
          notes: string | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          pager_number: string | null
          party_size: number | null
          payment_method: string | null
          payment_status: string | null
          ready_at: string | null
          scheduled_for: string | null
          served_at: string | null
          service_fee: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          status_before_cancellation:
            | Database["public"]["Enums"]["order_status"]
            | null
          subtotal: number | null
          table_id: string | null
          tenant_id: string | null
          total: number | null
          transaction_code: string | null
          updated_at: string | null
        }
        Insert: {
          additional_fee?: number | null
          archived_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          change_for?: number | null
          courier_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_neighborhood?: string | null
          delivery_status?: string | null
          discount?: number | null
          dispatched_at?: string | null
          external_customer_id?: string | null
          external_delivery_id?: string | null
          external_display_id?: string | null
          external_order_id?: string | null
          external_raw_payload?: Json | null
          external_source?: string | null
          fiscal_document?: string | null
          geocode_status?: string | null
          id?: string
          integracao_logistica_log?: string | null
          integracao_logistica_status?: string | null
          is_draft?: boolean | null
          logistics_group_id?: string | null
          logistics_status?: string | null
          notes?: string | null
          order_type?: Database["public"]["Enums"]["order_type"] | null
          pager_number?: string | null
          party_size?: number | null
          payment_method?: string | null
          payment_status?: string | null
          ready_at?: string | null
          scheduled_for?: string | null
          served_at?: string | null
          service_fee?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          status_before_cancellation?:
            | Database["public"]["Enums"]["order_status"]
            | null
          subtotal?: number | null
          table_id?: string | null
          tenant_id?: string | null
          total?: number | null
          transaction_code?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_fee?: number | null
          archived_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          change_for?: number | null
          courier_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_neighborhood?: string | null
          delivery_status?: string | null
          discount?: number | null
          dispatched_at?: string | null
          external_customer_id?: string | null
          external_delivery_id?: string | null
          external_display_id?: string | null
          external_order_id?: string | null
          external_raw_payload?: Json | null
          external_source?: string | null
          fiscal_document?: string | null
          geocode_status?: string | null
          id?: string
          integracao_logistica_log?: string | null
          integracao_logistica_status?: string | null
          is_draft?: boolean | null
          logistics_group_id?: string | null
          logistics_status?: string | null
          notes?: string | null
          order_type?: Database["public"]["Enums"]["order_type"] | null
          pager_number?: string | null
          party_size?: number | null
          payment_method?: string | null
          payment_status?: string | null
          ready_at?: string | null
          scheduled_for?: string | null
          served_at?: string | null
          service_fee?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          status_before_cancellation?:
            | Database["public"]["Enums"]["order_status"]
            | null
          subtotal?: number | null
          table_id?: string | null
          tenant_id?: string | null
          total?: number | null
          transaction_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_logistics_group_id_fkey"
            columns: ["logistics_group_id"]
            isOneToOne: false
            referencedRelation: "delivery_logistics_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events_processed: {
        Row: {
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          tenant_id: string | null
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          tenant_id?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_processed_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          courier_id: string
          created_at: string | null
          error_message: string | null
          external_id: string | null
          external_status: string | null
          id: string
          paid_at: string | null
          payout_request_id: string | null
          pix_key: string
          pix_key_type: string | null
          receipt_url: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          courier_id: string
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          external_status?: string | null
          id?: string
          paid_at?: string | null
          payout_request_id?: string | null
          pix_key: string
          pix_key_type?: string | null
          receipt_url?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          courier_id?: string
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          external_status?: string | null
          id?: string
          paid_at?: string | null
          payout_request_id?: string | null
          pix_key?: string
          pix_key_type?: string | null
          receipt_url?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payout_request_id_fkey"
            columns: ["payout_request_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cash_register_id: string | null
          created_at: string | null
          id: string
          is_partial: boolean | null
          order_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          received_by: string | null
          tenant_id: string | null
        }
        Insert: {
          amount: number
          cash_register_id?: string | null
          created_at?: string | null
          id?: string
          is_partial?: boolean | null
          order_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          received_by?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          cash_register_id?: string | null
          created_at?: string | null
          id?: string
          is_partial?: boolean | null
          order_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          received_by?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount: number
          courier_id: string
          created_at: string | null
          id: string
          pix_key: string | null
          pix_key_type: string | null
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          courier_id: string
          created_at?: string | null
          id?: string
          pix_key?: string | null
          pix_key_type?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          courier_id?: string
          created_at?: string | null
          id?: string
          pix_key?: string | null
          pix_key_type?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      print_queue: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          id: string
          print_type: string
          printed_at: string | null
          printed_by_device: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: Json
          id?: string
          print_type: string
          printed_at?: string | null
          printed_by_device?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          print_type?: string
          printed_at?: string | null
          printed_by_device?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      print_sectors: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          printer_name: string | null
          sort_order: number | null
          tenant_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          printer_name?: string | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          printer_name?: string | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_sectors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_complement_groups: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          product_id: string
          skip_flavor_modal: boolean
          sort_order: number | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          product_id: string
          skip_flavor_modal?: boolean
          sort_order?: number | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          product_id?: string
          skip_flavor_modal?: boolean
          sort_order?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_complement_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "complement_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_complement_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_complement_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_extra_links: {
        Row: {
          created_at: string | null
          extra_id: string
          id: string
          product_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          extra_id: string
          id?: string
          product_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          extra_id?: string
          id?: string
          product_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_extra_links_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "product_extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_extra_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_extra_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_extras: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_extras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          id: string
          ingredient_id: string
          product_id: string
          quantity: number
          tenant_id: string | null
        }
        Insert: {
          id?: string
          ingredient_id: string
          product_id: string
          quantity: number
          tenant_id?: string | null
        }
        Update: {
          id?: string
          ingredient_id?: string
          product_id?: string
          quantity?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipes: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity_multiplier: number
          recipe_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity_multiplier?: number
          recipe_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity_multiplier?: number
          recipe_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variations: {
        Row: {
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price_modifier: number | null
          product_id: string
          tenant_id: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price_modifier?: number | null
          product_id: string
          tenant_id?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_modifier?: number | null
          product_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_api_keys: {
        Row: {
          api_key: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          permissions: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          permissions?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          permissions?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_api_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          request_body: Json | null
          response_summary: string | null
          status_code: number | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: string | null
          method: string
          request_body?: Json | null
          response_summary?: string | null
          status_code?: number | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          request_body?: Json | null
          response_summary?: string | null
          status_code?: number | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "production_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_api_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          batch_label: string | null
          created_at: string
          expected_quantity: number
          expires_at: string | null
          id: string
          loss_quantity: number
          notes: string | null
          produced_by: string | null
          quantity_produced: number
          recipe_id: string
          tenant_id: string | null
        }
        Insert: {
          batch_label?: string | null
          created_at?: string
          expected_quantity?: number
          expires_at?: string | null
          id?: string
          loss_quantity?: number
          notes?: string | null
          produced_by?: string | null
          quantity_produced?: number
          recipe_id: string
          tenant_id?: string | null
        }
        Update: {
          batch_label?: string | null
          created_at?: string
          expected_quantity?: number
          expires_at?: string | null
          id?: string
          loss_quantity?: number
          notes?: string | null
          produced_by?: string | null
          quantity_produced?: number
          recipe_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_shipments: {
        Row: {
          from_tenant_id: string
          id: string
          ingredient_id: string
          notes: string | null
          quantity: number
          received_at: string | null
          received_by: string | null
          shipped_at: string
          shipped_by: string | null
          to_tenant_id: string
        }
        Insert: {
          from_tenant_id: string
          id?: string
          ingredient_id: string
          notes?: string | null
          quantity: number
          received_at?: string | null
          received_by?: string | null
          shipped_at?: string
          shipped_by?: string | null
          to_tenant_id: string
        }
        Update: {
          from_tenant_id?: string
          id?: string
          ingredient_id?: string
          notes?: string | null
          quantity?: number
          received_at?: string | null
          received_by?: string | null
          shipped_at?: string
          shipped_by?: string | null
          to_tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_shipments_from_tenant_id_fkey"
            columns: ["from_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_shipments_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_shipments_to_tenant_id_fkey"
            columns: ["to_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          adults_only: boolean
          allowed_times: Json
          available_for: string[]
          category_id: string | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          dispatch_keywords: string[] | null
          hide_observation_field: boolean
          id: string
          image_url: string | null
          internal_code: string | null
          is_available: boolean | null
          is_featured: boolean | null
          is_promotion: boolean | null
          label: string | null
          name: string
          operational_type: string
          pdv_code: string | null
          preparation_time: number | null
          price: number
          print_sector_id: string | null
          promotion_price: number | null
          promotional_price_schedules: Json | null
          sort_order: number | null
          tenant_id: string | null
          unit_type: string
          updated_at: string | null
        }
        Insert: {
          adults_only?: boolean
          allowed_times?: Json
          available_for?: string[]
          category_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          dispatch_keywords?: string[] | null
          hide_observation_field?: boolean
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_available?: boolean | null
          is_featured?: boolean | null
          is_promotion?: boolean | null
          label?: string | null
          name: string
          operational_type?: string
          pdv_code?: string | null
          preparation_time?: number | null
          price: number
          print_sector_id?: string | null
          promotion_price?: number | null
          promotional_price_schedules?: Json | null
          sort_order?: number | null
          tenant_id?: string | null
          unit_type?: string
          updated_at?: string | null
        }
        Update: {
          adults_only?: boolean
          allowed_times?: Json
          available_for?: string[]
          category_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          dispatch_keywords?: string[] | null
          hide_observation_field?: boolean
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_available?: boolean | null
          is_featured?: boolean | null
          is_promotion?: boolean | null
          label?: string | null
          name?: string
          operational_type?: string
          pdv_code?: string | null
          preparation_time?: number | null
          price?: number
          print_sector_id?: string | null
          promotion_price?: number | null
          promotional_price_schedules?: Json | null
          sort_order?: number | null
          tenant_id?: string | null
          unit_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_print_sector_id_fkey"
            columns: ["print_sector_id"]
            isOneToOne: false
            referencedRelation: "print_sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id: string
          name: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          quantity: number
          recipe_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          quantity?: number
          recipe_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          quantity?: number
          recipe_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          description: string | null
          expected_yield: number | null
          id: string
          name: string
          output_ingredient_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expected_yield?: number | null
          id?: string
          name: string
          output_ingredient_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expected_yield?: number | null
          id?: string
          name?: string
          output_ingredient_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_output_ingredient_id_fkey"
            columns: ["output_ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          notes: string | null
          party_size: number | null
          reservation_date: string
          reservation_time: string
          status: string | null
          table_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          party_size?: number | null
          reservation_date: string
          reservation_time: string
          status?: string | null
          table_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          party_size?: number | null
          reservation_date?: string
          reservation_time?: string
          status?: string | null
          table_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_announcements: {
        Row: {
          condition_comparison: string | null
          condition_threshold: number | null
          condition_type: string | null
          cooldown_minutes: number | null
          created_at: string | null
          created_by: string | null
          delay_threshold_minutes: number | null
          file_path: string
          id: string
          is_active: boolean | null
          last_played_at: string | null
          name: string
          schedule_type: string
          scheduled_date: string | null
          scheduled_days: number[] | null
          scheduled_time: string
          target_screens: string[] | null
          tenant_id: string | null
          trigger_type: string
          volume: number | null
        }
        Insert: {
          condition_comparison?: string | null
          condition_threshold?: number | null
          condition_type?: string | null
          cooldown_minutes?: number | null
          created_at?: string | null
          created_by?: string | null
          delay_threshold_minutes?: number | null
          file_path: string
          id?: string
          is_active?: boolean | null
          last_played_at?: string | null
          name: string
          schedule_type: string
          scheduled_date?: string | null
          scheduled_days?: number[] | null
          scheduled_time: string
          target_screens?: string[] | null
          tenant_id?: string | null
          trigger_type?: string
          volume?: number | null
        }
        Update: {
          condition_comparison?: string | null
          condition_threshold?: number | null
          condition_type?: string | null
          cooldown_minutes?: number | null
          created_at?: string | null
          created_by?: string | null
          delay_threshold_minutes?: number | null
          file_path?: string
          id?: string
          is_active?: boolean | null
          last_played_at?: string | null
          name?: string
          schedule_type?: string
          scheduled_date?: string | null
          scheduled_days?: number[] | null
          scheduled_time?: string
          target_screens?: string[] | null
          tenant_id?: string | null
          trigger_type?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_announcements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_presence: {
        Row: {
          device_id: string | null
          id: string
          is_online: boolean
          last_seen_at: string
          sector_id: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          device_id?: string | null
          id?: string
          is_online?: boolean
          last_seen_at?: string
          sector_id: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          device_id?: string | null
          id?: string
          is_online?: boolean
          last_seen_at?: string
          sector_id?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_presence_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "kds_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_presence_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          ingredient_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          new_stock: number
          notes: string | null
          order_id: string | null
          previous_stock: number
          quantity: number
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          ingredient_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          new_stock: number
          notes?: string | null
          order_id?: string | null
          previous_stock: number
          quantity: number
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          ingredient_id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          new_stock?: number
          notes?: string | null
          order_id?: string | null
          previous_stock?: number
          quantity?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_api_tokens: {
        Row: {
          api_token: string
          created_at: string | null
          created_by: string | null
          id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          api_token?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          api_token?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_api_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_kds_stations: number | null
          max_orders_per_month: number | null
          max_products: number | null
          max_tables: number | null
          max_tenants: number | null
          max_users: number | null
          name: string
          price_monthly: number
          price_yearly: number | null
          sort_order: number | null
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_kds_stations?: number | null
          max_orders_per_month?: number | null
          max_products?: number | null
          max_tables?: number | null
          max_tenants?: number | null
          max_users?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number | null
          sort_order?: number | null
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_kds_stations?: number | null
          max_orders_per_month?: number | null
          max_products?: number | null
          max_tables?: number | null
          max_tenants?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          sort_order?: number | null
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_switches: {
        Row: {
          from_table_id: string
          id: string
          order_id: string
          reason: string | null
          switched_at: string
          switched_by: string | null
          tenant_id: string | null
          to_table_id: string
        }
        Insert: {
          from_table_id: string
          id?: string
          order_id: string
          reason?: string | null
          switched_at?: string
          switched_by?: string | null
          tenant_id?: string | null
          to_table_id: string
        }
        Update: {
          from_table_id?: string
          id?: string
          order_id?: string
          reason?: string | null
          switched_at?: string
          switched_by?: string | null
          tenant_id?: string | null
          to_table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_switches_from_table_id_fkey"
            columns: ["from_table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_switches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_switches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_switches_to_table_id_fkey"
            columns: ["to_table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity: number | null
          created_at: string | null
          id: string
          number: number
          position_x: number | null
          position_y: number | null
          status: Database["public"]["Enums"]["table_status"] | null
          tenant_id: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          number: number
          position_x?: number | null
          position_y?: number | null
          status?: Database["public"]["Enums"]["table_status"] | null
          tenant_id?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          number?: number
          position_x?: number | null
          position_y?: number | null
          status?: Database["public"]["Enums"]["table_status"] | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          id: string
          invited_at: string | null
          invited_by: string | null
          is_owner: boolean | null
          joined_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_owner?: boolean | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_owner?: boolean | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          cnpj: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      unmapped_sales: {
        Row: {
          created_at: string
          id: string
          order_id: string
          order_item_id: string
          product_name: string
          quantity: number
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          order_item_id: string
          product_name: string
          quantity?: number
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          order_item_id?: string
          product_name?: string
          quantity?: number
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unmapped_sales_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unmapped_sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          granted: boolean
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["permission_code"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["permission_code"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["permission_code"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          sector_id: string | null
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          sector_id?: string | null
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          sector_id?: string | null
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "kds_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          amount: number
          courier_id: string
          created_at: string | null
          description: string | null
          entry_type: string
          id: string
          matured_at: string | null
          reference_id: string | null
          reference_type: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          courier_id: string
          created_at?: string | null
          description?: string | null
          entry_type?: string
          id?: string
          matured_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          courier_id?: string
          created_at?: string | null
          description?: string | null
          entry_type?: string
          id?: string
          matured_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_production_demand: {
        Row: {
          current_stock: number | null
          day_of_week: number | null
          ideal_stock: number | null
          ingredient_id: string | null
          ingredient_name: string | null
          status: string | null
          store_name: string | null
          tenant_id: string | null
          to_produce: number | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_daily_targets_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_daily_targets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_stock_movements_for_order: {
        Args: { _order_id: string }
        Returns: undefined
      }
      belongs_to_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      can_bootstrap_admin:
        | { Args: { _user_id: string }; Returns: boolean }
        | { Args: { _tenant_id: string; _user_id: string }; Returns: boolean }
      check_order_completion: {
        Args: { _order_id: string }
        Returns: undefined
      }
      claim_order_item: {
        Args: { _item_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_kds_station_logs: { Args: never; Returns: undefined }
      complete_edge_preparation: {
        Args: { _item_id: string; _user_id: string }
        Returns: boolean
      }
      extract_option_from_extra_name: {
        Args: { _extra_name: string }
        Returns: string
      }
      get_least_loaded_sector: {
        Args: { _exclude_edge?: boolean; _tenant_id: string }
        Returns: string
      }
      get_least_loaded_sector_online: {
        Args: { _tenant_id: string }
        Returns: string
      }
      get_user_tenant_id: { Args: never; Returns: string }
      has_active_subscription: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      has_permission:
        | {
            Args: {
              _permission: Database["public"]["Enums"]["permission_code"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _permission: Database["public"]["Enums"]["permission_code"]
              _tenant_id?: string
              _user_id: string
            }
            Returns: boolean
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_employee: { Args: { _user_id: string }; Returns: boolean }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_owner: { Args: { _tenant_id: string }; Returns: boolean }
      mark_item_ready: {
        Args: { _item_id: string; _user_id?: string }
        Returns: boolean
      }
      promote_pending_wallet_entries: {
        Args: { p_minutes?: number }
        Returns: number
      }
      recalculate_wallet_balance: {
        Args: { p_courier_id: string }
        Returns: undefined
      }
      redistribute_offline_sector_items: {
        Args: { _tenant_id: string }
        Returns: number
      }
      release_buffered_order: { Args: { _order_id: string }; Returns: boolean }
      reroute_item_if_border: { Args: { _item_id: string }; Returns: boolean }
      send_to_oven: {
        Args: { _item_id: string; _oven_minutes?: number; _user_id?: string }
        Returns: boolean
      }
      upsert_sector_presence: {
        Args: {
          _device_id?: string
          _sector_id: string
          _tenant_id: string
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "cashier"
        | "waiter"
        | "kitchen"
        | "kds"
        | "platform_admin"
        | "courier"
      cash_register_status: "open" | "closed"
      order_status:
        | "pending"
        | "preparing"
        | "ready"
        | "delivered"
        | "cancelled"
        | "dispatched"
        | "delivering"
      order_type: "dine_in" | "takeaway" | "delivery"
      payment_method: "cash" | "credit_card" | "debit_card" | "pix"
      permission_code:
        | "orders_view"
        | "orders_edit"
        | "tables_view"
        | "tables_switch"
        | "tables_move_items"
        | "tables_reprint_items"
        | "tables_cancel_items"
        | "tables_cancel_order"
        | "tables_manage_payments"
        | "tables_reopen"
        | "tables_close"
        | "tables_change_fees"
        | "tables_order_as_other"
        | "delivery_view"
        | "delivery_manage"
        | "customers_view"
        | "customers_manage"
        | "settings_general"
        | "settings_print"
        | "settings_users"
        | "reports_view"
        | "reports_export"
        | "cash_register_view"
        | "cash_register_manage"
        | "menu_view"
        | "menu_manage"
        | "kds_view"
        | "kds_change_status"
        | "counter_view"
        | "counter_add_items"
        | "counter_apply_discount"
        | "counter_process_payment"
        | "audit_view"
        | "audit_export"
        | "stock_view"
        | "stock_manage"
        | "dashboard_view"
        | "performance_view"
        | "combos_manage"
        | "reservations_view"
        | "reservations_manage"
        | "reservations_cancel"
        | "cash_open"
        | "cash_close"
        | "cash_withdraw"
        | "cash_supply"
        | "settings_notifications"
        | "settings_tables"
        | "settings_announcements"
        | "settings_kds"
        | "settings_idle_tables"
        | "print_kitchen_ticket"
        | "print_customer_receipt"
        | "print_reprint"
        | "stock_add"
        | "stock_adjust"
        | "stock_view_movements"
        | "orders_cancel"
        | "orders_create"
        | "orders_print"
        | "closing_history_view"
        | "closing_history_export"
        | "reopen_history_view"
        | "cash_view_difference"
        | "production_view"
        | "production_manage"
        | "targets_manage"
      stock_movement_type: "entry" | "exit" | "adjustment"
      table_status: "available" | "occupied" | "reserved" | "bill_requested"
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
    Enums: {
      app_role: [
        "admin",
        "cashier",
        "waiter",
        "kitchen",
        "kds",
        "platform_admin",
        "courier",
      ],
      cash_register_status: ["open", "closed"],
      order_status: [
        "pending",
        "preparing",
        "ready",
        "delivered",
        "cancelled",
        "dispatched",
        "delivering",
      ],
      order_type: ["dine_in", "takeaway", "delivery"],
      payment_method: ["cash", "credit_card", "debit_card", "pix"],
      permission_code: [
        "orders_view",
        "orders_edit",
        "tables_view",
        "tables_switch",
        "tables_move_items",
        "tables_reprint_items",
        "tables_cancel_items",
        "tables_cancel_order",
        "tables_manage_payments",
        "tables_reopen",
        "tables_close",
        "tables_change_fees",
        "tables_order_as_other",
        "delivery_view",
        "delivery_manage",
        "customers_view",
        "customers_manage",
        "settings_general",
        "settings_print",
        "settings_users",
        "reports_view",
        "reports_export",
        "cash_register_view",
        "cash_register_manage",
        "menu_view",
        "menu_manage",
        "kds_view",
        "kds_change_status",
        "counter_view",
        "counter_add_items",
        "counter_apply_discount",
        "counter_process_payment",
        "audit_view",
        "audit_export",
        "stock_view",
        "stock_manage",
        "dashboard_view",
        "performance_view",
        "combos_manage",
        "reservations_view",
        "reservations_manage",
        "reservations_cancel",
        "cash_open",
        "cash_close",
        "cash_withdraw",
        "cash_supply",
        "settings_notifications",
        "settings_tables",
        "settings_announcements",
        "settings_kds",
        "settings_idle_tables",
        "print_kitchen_ticket",
        "print_customer_receipt",
        "print_reprint",
        "stock_add",
        "stock_adjust",
        "stock_view_movements",
        "orders_cancel",
        "orders_create",
        "orders_print",
        "closing_history_view",
        "closing_history_export",
        "reopen_history_view",
        "cash_view_difference",
        "production_view",
        "production_manage",
        "targets_manage",
      ],
      stock_movement_type: ["entry", "exit", "adjustment"],
      table_status: ["available", "occupied", "reserved", "bill_requested"],
    },
  },
} as const
