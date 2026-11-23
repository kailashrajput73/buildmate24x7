using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace BuildMate.Data.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "dispatch_no_seq");

            migrationBuilder.CreateSequence(
                name: "invoice_no_seq");

            migrationBuilder.CreateSequence(
                name: "order_no_seq");

            migrationBuilder.CreateSequence(
                name: "product_code_seq");

            migrationBuilder.CreateSequence(
                name: "purchase_no_seq");

            migrationBuilder.CreateSequence(
                name: "quote_no_seq");

            migrationBuilder.CreateSequence(
                name: "service_request_no_seq");

            migrationBuilder.CreateTable(
                name: "banners",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    title = table.Column<string>(type: "text", nullable: false),
                    subtitle = table.Column<string>(type: "text", nullable: true),
                    image_url = table.Column<string>(type: "text", nullable: false),
                    mobile_image_url = table.Column<string>(type: "text", nullable: true),
                    link_type = table.Column<int>(type: "integer", nullable: false),
                    link_value = table.Column<string>(type: "text", nullable: true),
                    placement = table.Column<int>(type: "integer", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    starts_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ends_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_id = table.Column<long>(type: "bigint", nullable: true),
                    updated_by_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_banners", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "brands",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    logo_url = table.Column<string>(type: "text", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_id = table.Column<long>(type: "bigint", nullable: true),
                    updated_by_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_brands", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    image_url = table.Column<string>(type: "text", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_id = table.Column<long>(type: "bigint", nullable: true),
                    updated_by_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_categories", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "device_tokens",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    token = table.Column<string>(type: "text", nullable: false),
                    platform = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_device_tokens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "home_sections",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    title = table.Column<string>(type: "text", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    reference_id = table.Column<long>(type: "bigint", nullable: true),
                    max_items = table.Column<int>(type: "integer", nullable: false),
                    placement = table.Column<int>(type: "integer", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_id = table.Column<long>(type: "bigint", nullable: true),
                    updated_by_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_home_sections", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    body = table.Column<string>(type: "text", nullable: false),
                    link = table.Column<string>(type: "text", nullable: true),
                    is_read = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notifications", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "otp_codes",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    phone = table.Column<string>(type: "text", nullable: false),
                    code_hash = table.Column<string>(type: "text", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    consumed = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_otp_codes", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "outbox_messages",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    event_type = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    payload = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    next_attempt_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_error = table.Column<string>(type: "text", nullable: true),
                    processed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_outbox_messages", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "product_groups",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    image_url = table.Column<string>(type: "text", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_id = table.Column<long>(type: "bigint", nullable: true),
                    updated_by_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_groups", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "purchases",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    purchase_no = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    supplier_name = table.Column<string>(type: "text", nullable: true),
                    supplier_gstin = table.Column<string>(type: "text", nullable: true),
                    supplier_invoice_no = table.Column<string>(type: "text", nullable: true),
                    purchase_date = table.Column<DateOnly>(type: "date", nullable: false),
                    total_amount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_id = table.Column<long>(type: "bigint", nullable: true),
                    updated_by_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_purchases", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "racks",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    name = table.Column<string>(type: "text", nullable: true),
                    rows = table.Column<int>(type: "integer", nullable: false),
                    columns = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_id = table.Column<long>(type: "bigint", nullable: true),
                    updated_by_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_racks", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    permissions = table.Column<List<string>>(type: "text[]", nullable: false),
                    is_system = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "settings",
                columns: table => new
                {
                    key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    value = table.Column<string>(type: "text", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_settings", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "sub_categories",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    category_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_id = table.Column<long>(type: "bigint", nullable: true),
                    updated_by_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sub_categories", x => x.id);
                    table.ForeignKey(
                        name: "fk_sub_categories_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "rack_locations",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    rack_id = table.Column<long>(type: "bigint", nullable: false),
                    label = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    row_no = table.Column<int>(type: "integer", nullable: false),
                    column_no = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rack_locations", x => x.id);
                    table.ForeignKey(
                        name: "fk_rack_locations_racks_rack_id",
                        column: x => x.rack_id,
                        principalTable: "racks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_type = table.Column<int>(type: "integer", nullable: false),
                    phone = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: true),
                    email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    password_hash = table.Column<string>(type: "text", nullable: true),
                    role_id = table.Column<long>(type: "bigint", nullable: true),
                    preferred_language = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    last_login_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                    table.ForeignKey(
                        name: "fk_users_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "products",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    variant_family = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    variant_label = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    specs = table.Column<List<string>>(type: "text[]", nullable: false),
                    category_id = table.Column<long>(type: "bigint", nullable: false),
                    sub_category_id = table.Column<long>(type: "bigint", nullable: true),
                    brand_id = table.Column<long>(type: "bigint", nullable: false),
                    barcode = table.Column<string>(type: "text", nullable: true),
                    unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    hsn_code = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: true),
                    gst_rate = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    mrp = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    list_price = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    partner_discount_percent = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    retail_discount_percent = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    reward_points_per_unit = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    reorder_level = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    sequence = table.Column<int>(type: "integer", nullable: false),
                    stock_qty = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    reserved_qty = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    average_cost = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    last_dispatched_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    aging_from_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    image_urls = table.Column<List<string>>(type: "text[]", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    show_on_web = table.Column<bool>(type: "boolean", nullable: false),
                    show_on_app = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_id = table.Column<long>(type: "bigint", nullable: true),
                    updated_by_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_products", x => x.id);
                    table.ForeignKey(
                        name: "fk_products_brands_brand_id",
                        column: x => x.brand_id,
                        principalTable: "brands",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_products_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_products_sub_categories_sub_category_id",
                        column: x => x.sub_category_id,
                        principalTable: "sub_categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "addresses",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    phone = table.Column<string>(type: "text", nullable: false),
                    line1 = table.Column<string>(type: "text", nullable: false),
                    line2 = table.Column<string>(type: "text", nullable: true),
                    landmark = table.Column<string>(type: "text", nullable: true),
                    city = table.Column<string>(type: "text", nullable: false),
                    state = table.Column<string>(type: "text", nullable: false),
                    pincode = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_addresses", x => x.id);
                    table.ForeignKey(
                        name: "fk_addresses_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "orders",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    order_no = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: true),
                    channel = table.Column<int>(type: "integer", nullable: false),
                    customer_kind = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    fulfilment_type = table.Column<int>(type: "integer", nullable: false),
                    scheduled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    customer_name = table.Column<string>(type: "text", nullable: false),
                    customer_phone = table.Column<string>(type: "text", nullable: true),
                    customer_gstin = table.Column<string>(type: "text", nullable: true),
                    ship_line1 = table.Column<string>(type: "text", nullable: true),
                    ship_line2 = table.Column<string>(type: "text", nullable: true),
                    ship_city = table.Column<string>(type: "text", nullable: true),
                    ship_state = table.Column<string>(type: "text", nullable: true),
                    ship_pincode = table.Column<string>(type: "text", nullable: true),
                    sub_total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    discount_total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    tax_total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    shipping_fee = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    round_off = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    grand_total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    amount_paid = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    reward_points_earned = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    rewards_credited = table.Column<bool>(type: "boolean", nullable: false),
                    payment_status = table.Column<int>(type: "integer", nullable: false),
                    payment_method = table.Column<int>(type: "integer", nullable: false),
                    paid_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    stock_reserved = table.Column<bool>(type: "boolean", nullable: false),
                    customer_notes = table.Column<string>(type: "text", nullable: true),
                    internal_notes = table.Column<string>(type: "text", nullable: true),
                    cancelled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancel_reason = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_orders", x => x.id);
                    table.ForeignKey(
                        name: "fk_orders_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "partner_profiles",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    partner_type = table.Column<int>(type: "integer", nullable: false),
                    business_name = table.Column<string>(type: "text", nullable: true),
                    address_line = table.Column<string>(type: "text", nullable: true),
                    area = table.Column<string>(type: "text", nullable: true),
                    city = table.Column<string>(type: "text", nullable: true),
                    state = table.Column<string>(type: "text", nullable: true),
                    pincode = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: true),
                    latitude = table.Column<double>(type: "double precision", nullable: true),
                    longitude = table.Column<double>(type: "double precision", nullable: true),
                    gstin = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: true),
                    kyc_status = table.Column<int>(type: "integer", nullable: false),
                    kyc_submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    kyc_reviewed_by_id = table.Column<long>(type: "bigint", nullable: true),
                    kyc_reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    kyc_remarks = table.Column<string>(type: "text", nullable: true),
                    location_verified = table.Column<bool>(type: "boolean", nullable: false),
                    manager_id = table.Column<long>(type: "bigint", nullable: true),
                    created_by_admin = table.Column<bool>(type: "boolean", nullable: false),
                    reward_balance = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_partner_profiles", x => x.id);
                    table.ForeignKey(
                        name: "fk_partner_profiles_users_kyc_reviewed_by_id",
                        column: x => x.kyc_reviewed_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_partner_profiles_users_manager_id",
                        column: x => x.manager_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_partner_profiles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    token_hash = table.Column<string>(type: "text", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_refresh_tokens", x => x.id);
                    table.ForeignKey(
                        name: "fk_refresh_tokens_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "reward_transactions",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    partner_user_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    points = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    balance_after = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    order_id = table.Column<long>(type: "bigint", nullable: true),
                    note = table.Column<string>(type: "text", nullable: true),
                    created_by_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_reward_transactions", x => x.id);
                    table.ForeignKey(
                        name: "fk_reward_transactions_users_partner_user_id",
                        column: x => x.partner_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "service_requests",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    request_no = table.Column<string>(type: "text", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    service_type = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    contact_name = table.Column<string>(type: "text", nullable: false),
                    contact_phone = table.Column<string>(type: "text", nullable: false),
                    address = table.Column<string>(type: "text", nullable: true),
                    pincode = table.Column<string>(type: "text", nullable: true),
                    preferred_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    assigned_partner_id = table.Column<long>(type: "bigint", nullable: true),
                    admin_notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_service_requests", x => x.id);
                    table.ForeignKey(
                        name: "fk_service_requests_users_assigned_partner_id",
                        column: x => x.assigned_partner_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_service_requests_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "cart_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cart_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_cart_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_cart_items_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_aliases",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    alias = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_aliases", x => x.id);
                    table.ForeignKey(
                        name: "fk_product_aliases_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_group_items",
                columns: table => new
                {
                    product_group_id = table.Column<long>(type: "bigint", nullable: false),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_group_items", x => new { x.product_group_id, x.product_id });
                    table.ForeignKey(
                        name: "fk_product_group_items_product_groups_product_group_id",
                        column: x => x.product_group_id,
                        principalTable: "product_groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_product_group_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_locations",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    rack_location_id = table.Column<long>(type: "bigint", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_locations", x => x.id);
                    table.ForeignKey(
                        name: "fk_product_locations_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_product_locations_rack_locations_rack_location_id",
                        column: x => x.rack_location_id,
                        principalTable: "rack_locations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "product_translations",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    language_code = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    name = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_translations", x => x.id);
                    table.ForeignKey(
                        name: "fk_product_translations_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "purchase_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    purchase_id = table.Column<long>(type: "bigint", nullable: false),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    list_price = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    purchase_discount_percent = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    net_rate = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    line_total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    rack_location_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_purchase_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_purchase_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_purchase_items_purchases_purchase_id",
                        column: x => x.purchase_id,
                        principalTable: "purchases",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_purchase_items_rack_locations_rack_location_id",
                        column: x => x.rack_location_id,
                        principalTable: "rack_locations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "stock_movements",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    balance_after = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    unit_cost = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    reference_type = table.Column<string>(type: "text", nullable: true),
                    reference_id = table.Column<long>(type: "bigint", nullable: true),
                    reference_no = table.Column<string>(type: "text", nullable: true),
                    note = table.Column<string>(type: "text", nullable: true),
                    user_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_movements", x => x.id);
                    table.ForeignKey(
                        name: "fk_stock_movements_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "dispatches",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    order_id = table.Column<long>(type: "bigint", nullable: false),
                    dispatch_no = table.Column<string>(type: "text", nullable: false),
                    invoice_no = table.Column<string>(type: "text", nullable: false),
                    dispatched_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    dispatched_by_id = table.Column<long>(type: "bigint", nullable: false),
                    dispatched_by_name = table.Column<string>(type: "text", nullable: true),
                    vehicle_no = table.Column<string>(type: "text", nullable: true),
                    delivery_person = table.Column<string>(type: "text", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_dispatches", x => x.id);
                    table.ForeignKey(
                        name: "fk_dispatches_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "order_events",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    order_id = table.Column<long>(type: "bigint", nullable: false),
                    action = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    details = table.Column<string>(type: "text", nullable: true),
                    user_id = table.Column<long>(type: "bigint", nullable: true),
                    user_name = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_events", x => x.id);
                    table.ForeignKey(
                        name: "fk_order_events_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "order_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    order_id = table.Column<long>(type: "bigint", nullable: false),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    product_code = table.Column<string>(type: "text", nullable: false),
                    product_name = table.Column<string>(type: "text", nullable: false),
                    hsn_code = table.Column<string>(type: "text", nullable: true),
                    quantity = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    list_price = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    discount_percent = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    special_discount_percent = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    gst_rate = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    tax_amount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    line_total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    reward_points = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    added_at_store = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_order_items_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_order_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    order_id = table.Column<long>(type: "bigint", nullable: false),
                    method = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    gateway_order_id = table.Column<string>(type: "text", nullable: true),
                    gateway_reference = table.Column<string>(type: "text", nullable: true),
                    payment_session_id = table.Column<string>(type: "text", nullable: true),
                    raw_response = table.Column<string>(type: "text", nullable: true),
                    collected_by_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payments", x => x.id);
                    table.ForeignKey(
                        name: "fk_payments_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "quotations",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    quote_no = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    customer_kind = table.Column<int>(type: "integer", nullable: false),
                    channel = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    fulfilment_type = table.Column<int>(type: "integer", nullable: false),
                    address_id = table.Column<long>(type: "bigint", nullable: true),
                    preferred_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    customer_notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    customer_name = table.Column<string>(type: "text", nullable: false),
                    customer_phone = table.Column<string>(type: "text", nullable: true),
                    sub_total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    discount_total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    shipping_fee = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    round_off = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    grand_total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    store_message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    quoted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    quoted_by_id = table.Column<long>(type: "bigint", nullable: true),
                    quoted_by_name = table.Column<string>(type: "text", nullable: true),
                    valid_until = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    responded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancel_reason = table.Column<string>(type: "text", nullable: true),
                    order_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_quotations", x => x.id);
                    table.ForeignKey(
                        name: "fk_quotations_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_quotations_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "kyc_documents",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    partner_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    document_type = table.Column<int>(type: "integer", nullable: false),
                    document_number_masked = table.Column<string>(type: "text", nullable: true),
                    file_key = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_kyc_documents", x => x.id);
                    table.ForeignKey(
                        name: "fk_kyc_documents_partner_profiles_partner_profile_id",
                        column: x => x.partner_profile_id,
                        principalTable: "partner_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "service_request_events",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    service_request_id = table.Column<long>(type: "bigint", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    note = table.Column<string>(type: "text", nullable: true),
                    user_id = table.Column<long>(type: "bigint", nullable: true),
                    user_name = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_service_request_events", x => x.id);
                    table.ForeignKey(
                        name: "fk_service_request_events_service_requests_service_request_id",
                        column: x => x.service_request_id,
                        principalTable: "service_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "quotation_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    quotation_id = table.Column<long>(type: "bigint", nullable: false),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    product_code = table.Column<string>(type: "text", nullable: false),
                    product_name = table.Column<string>(type: "text", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    list_price = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    discount_percent = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    special_discount_percent = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    line_total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    gst_rate = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    reward_points = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_quotation_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_quotation_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_quotation_items_quotations_quotation_id",
                        column: x => x.quotation_id,
                        principalTable: "quotations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_addresses_user_id",
                table: "addresses",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_brands_name",
                table: "brands",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_cart_items_product_id",
                table: "cart_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_cart_items_user_id_product_id",
                table: "cart_items",
                columns: new[] { "user_id", "product_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_categories_name",
                table: "categories",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_device_tokens_token",
                table: "device_tokens",
                column: "token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_dispatches_dispatch_no",
                table: "dispatches",
                column: "dispatch_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_dispatches_dispatched_at",
                table: "dispatches",
                column: "dispatched_at");

            migrationBuilder.CreateIndex(
                name: "ix_dispatches_invoice_no",
                table: "dispatches",
                column: "invoice_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_dispatches_order_id",
                table: "dispatches",
                column: "order_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_kyc_documents_partner_profile_id",
                table: "kyc_documents",
                column: "partner_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_user_id_is_read_created_at",
                table: "notifications",
                columns: new[] { "user_id", "is_read", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_order_events_order_id",
                table: "order_events",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_items_order_id",
                table: "order_items",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_items_product_id",
                table: "order_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_order_no",
                table: "orders",
                column: "order_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_orders_status_created_at",
                table: "orders",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_orders_user_id_created_at",
                table: "orders",
                columns: new[] { "user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_otp_codes_phone_created_at",
                table: "otp_codes",
                columns: new[] { "phone", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_outbox_messages_status_next_attempt_at",
                table: "outbox_messages",
                columns: new[] { "status", "next_attempt_at" });

            migrationBuilder.CreateIndex(
                name: "ix_partner_profiles_kyc_reviewed_by_id",
                table: "partner_profiles",
                column: "kyc_reviewed_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_partner_profiles_kyc_status",
                table: "partner_profiles",
                column: "kyc_status");

            migrationBuilder.CreateIndex(
                name: "ix_partner_profiles_manager_id",
                table: "partner_profiles",
                column: "manager_id");

            migrationBuilder.CreateIndex(
                name: "ix_partner_profiles_pincode",
                table: "partner_profiles",
                column: "pincode");

            migrationBuilder.CreateIndex(
                name: "ix_partner_profiles_user_id",
                table: "partner_profiles",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_payments_gateway_order_id",
                table: "payments",
                column: "gateway_order_id",
                unique: true,
                filter: "gateway_order_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_payments_order_id",
                table: "payments",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_product_aliases_alias",
                table: "product_aliases",
                column: "alias");

            migrationBuilder.CreateIndex(
                name: "ix_product_aliases_product_id",
                table: "product_aliases",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_product_group_items_product_id",
                table: "product_group_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_product_groups_name",
                table: "product_groups",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_locations_product_id_rack_location_id",
                table: "product_locations",
                columns: new[] { "product_id", "rack_location_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_locations_rack_location_id",
                table: "product_locations",
                column: "rack_location_id");

            migrationBuilder.CreateIndex(
                name: "ix_product_translations_product_id_language_code",
                table: "product_translations",
                columns: new[] { "product_id", "language_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_products_aging_from_at",
                table: "products",
                column: "aging_from_at");

            migrationBuilder.CreateIndex(
                name: "ix_products_barcode",
                table: "products",
                column: "barcode");

            migrationBuilder.CreateIndex(
                name: "ix_products_brand_id",
                table: "products",
                column: "brand_id");

            migrationBuilder.CreateIndex(
                name: "ix_products_category_id",
                table: "products",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ix_products_code",
                table: "products",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_products_is_active_sequence",
                table: "products",
                columns: new[] { "is_active", "sequence" });

            migrationBuilder.CreateIndex(
                name: "ix_products_last_dispatched_at",
                table: "products",
                column: "last_dispatched_at");

            migrationBuilder.CreateIndex(
                name: "ix_products_sub_category_id",
                table: "products",
                column: "sub_category_id");

            migrationBuilder.CreateIndex(
                name: "ix_products_variant_family_sequence",
                table: "products",
                columns: new[] { "variant_family", "sequence" });

            migrationBuilder.CreateIndex(
                name: "ix_purchase_items_product_id",
                table: "purchase_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_purchase_items_purchase_id",
                table: "purchase_items",
                column: "purchase_id");

            migrationBuilder.CreateIndex(
                name: "ix_purchase_items_rack_location_id",
                table: "purchase_items",
                column: "rack_location_id");

            migrationBuilder.CreateIndex(
                name: "ix_purchases_purchase_date",
                table: "purchases",
                column: "purchase_date");

            migrationBuilder.CreateIndex(
                name: "ix_purchases_purchase_no",
                table: "purchases",
                column: "purchase_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_quotation_items_product_id",
                table: "quotation_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_quotation_items_quotation_id",
                table: "quotation_items",
                column: "quotation_id");

            migrationBuilder.CreateIndex(
                name: "ix_quotations_order_id",
                table: "quotations",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_quotations_quote_no",
                table: "quotations",
                column: "quote_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_quotations_status_created_at",
                table: "quotations",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_quotations_user_id_created_at",
                table: "quotations",
                columns: new[] { "user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_rack_locations_label",
                table: "rack_locations",
                column: "label",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_rack_locations_rack_id",
                table: "rack_locations",
                column: "rack_id");

            migrationBuilder.CreateIndex(
                name: "ix_racks_code",
                table: "racks",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_token_hash",
                table: "refresh_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_user_id",
                table: "refresh_tokens",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_reward_transactions_partner_user_id_created_at",
                table: "reward_transactions",
                columns: new[] { "partner_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_roles_name",
                table: "roles",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_service_request_events_service_request_id",
                table: "service_request_events",
                column: "service_request_id");

            migrationBuilder.CreateIndex(
                name: "ix_service_requests_assigned_partner_id",
                table: "service_requests",
                column: "assigned_partner_id");

            migrationBuilder.CreateIndex(
                name: "ix_service_requests_request_no",
                table: "service_requests",
                column: "request_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_service_requests_status_created_at",
                table: "service_requests",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_service_requests_user_id",
                table: "service_requests",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_movements_created_at",
                table: "stock_movements",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_stock_movements_product_id_created_at",
                table: "stock_movements",
                columns: new[] { "product_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_sub_categories_category_id_name",
                table: "sub_categories",
                columns: new[] { "category_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_email",
                table: "users",
                column: "email",
                unique: true,
                filter: "email IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_users_role_id",
                table: "users",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "ix_users_user_type_phone",
                table: "users",
                columns: new[] { "user_type", "phone" },
                unique: true,
                filter: "phone IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "addresses");

            migrationBuilder.DropTable(
                name: "banners");

            migrationBuilder.DropTable(
                name: "cart_items");

            migrationBuilder.DropTable(
                name: "device_tokens");

            migrationBuilder.DropTable(
                name: "dispatches");

            migrationBuilder.DropTable(
                name: "home_sections");

            migrationBuilder.DropTable(
                name: "kyc_documents");

            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "order_events");

            migrationBuilder.DropTable(
                name: "order_items");

            migrationBuilder.DropTable(
                name: "otp_codes");

            migrationBuilder.DropTable(
                name: "outbox_messages");

            migrationBuilder.DropTable(
                name: "payments");

            migrationBuilder.DropTable(
                name: "product_aliases");

            migrationBuilder.DropTable(
                name: "product_group_items");

            migrationBuilder.DropTable(
                name: "product_locations");

            migrationBuilder.DropTable(
                name: "product_translations");

            migrationBuilder.DropTable(
                name: "purchase_items");

            migrationBuilder.DropTable(
                name: "quotation_items");

            migrationBuilder.DropTable(
                name: "refresh_tokens");

            migrationBuilder.DropTable(
                name: "reward_transactions");

            migrationBuilder.DropTable(
                name: "service_request_events");

            migrationBuilder.DropTable(
                name: "settings");

            migrationBuilder.DropTable(
                name: "stock_movements");

            migrationBuilder.DropTable(
                name: "partner_profiles");

            migrationBuilder.DropTable(
                name: "product_groups");

            migrationBuilder.DropTable(
                name: "purchases");

            migrationBuilder.DropTable(
                name: "rack_locations");

            migrationBuilder.DropTable(
                name: "quotations");

            migrationBuilder.DropTable(
                name: "service_requests");

            migrationBuilder.DropTable(
                name: "products");

            migrationBuilder.DropTable(
                name: "racks");

            migrationBuilder.DropTable(
                name: "orders");

            migrationBuilder.DropTable(
                name: "brands");

            migrationBuilder.DropTable(
                name: "sub_categories");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.DropTable(
                name: "roles");

            migrationBuilder.DropSequence(
                name: "dispatch_no_seq");

            migrationBuilder.DropSequence(
                name: "invoice_no_seq");

            migrationBuilder.DropSequence(
                name: "order_no_seq");

            migrationBuilder.DropSequence(
                name: "product_code_seq");

            migrationBuilder.DropSequence(
                name: "purchase_no_seq");

            migrationBuilder.DropSequence(
                name: "quote_no_seq");

            migrationBuilder.DropSequence(
                name: "service_request_no_seq");
        }
    }
}
