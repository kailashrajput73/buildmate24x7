using System.Text;
using BuildMate.Domain.Entities;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using BuildMate.Services.Inventory;
using Xunit;

namespace BuildMate.Tests;

/// <summary>Unit tests (no database): product Module/Color/Series/Current rating and bulk stock validation.</summary>
public class ProductAttributeRulesTests
{
    // ---- Task 1: current rating + specifications ----

    [Theory]
    [InlineData("volt", "volt")]
    [InlineData(" Watt ", "watt")]
    [InlineData("AMP", "amp")]
    [InlineData("", null)]
    [InlineData(null, null)]
    [InlineData("none", null)]
    public void Current_rating_accepts_only_volt_watt_amp(string? input, string? expected) =>
        Assert.Equal(expected, ProductAttributes.CurrentRating(input));

    [Theory]
    [InlineData("kw")]
    [InlineData("volts")]
    [InlineData("ampere")]
    public void Current_rating_rejects_other_values_with_a_clear_error(string input)
    {
        var e = Assert.Throws<AppException>(() => ProductAttributes.CurrentRating(input));
        Assert.Contains("volt, watt or amp", e.Message);
    }

    [Fact]
    public void Specs_show_only_the_fields_that_are_set()
    {
        Assert.Empty(ProductAttributes.Specs(new Product { Code = "X", Name = "X" }));
        var specs = ProductAttributes.Specs(new Product { Code = "X", Name = "X", Module = "2M", Series = "Piano", CurrentRating = "amp" }).ToList();
        Assert.Equal("Module=2M; Series=Piano; Current rating=Amp", string.Join("; ", specs.Select(x => $"{x.Name}={x.Value}")));
    }

    // ---- Task 3: bulk stock rows ----

    private static readonly Dictionary<string, BulkStockProduct> Products = new(StringComparer.OrdinalIgnoreCase)
    {
        ["A1"] = new(1, "A1", "Switch", "pcs", 10, 0),
        ["B2"] = new(2, "B2", "Wire", "m", 50, 5),
    };
    private static readonly Dictionary<string, List<BulkStockProduct>> Barcodes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["890001"] = new() { Products["A1"] },
        ["890999"] = new() { Products["A1"], Products["B2"] },
    };
    private static long? Rack(string label) => label.Equals("R1-A1", StringComparison.OrdinalIgnoreCase) ? 7 : null;
    private static BulkStockInputRow Row(int row, string? code, string? qty, string? mode = null, string? rack = null, string? barcode = null) =>
        new(row, code, barcode, qty, mode, rack, null);
    private static List<BulkStockRowResult> Check(string defaultMode, params BulkStockInputRow[] rows) =>
        BulkStockRules.Validate(rows, defaultMode, Products, Barcodes, Rack);

    [Fact]
    public void Set_replaces_and_add_increases_stock()
    {
        var r = Check("set", Row(2, "A1", "25"), Row(3, "B2", "5", "add"));
        Assert.Equal(25, r[0].NewStock); Assert.Equal("OK", r[0].Status); Assert.Equal("set", r[0].Mode);
        Assert.Equal(55, r[1].NewStock); Assert.Equal("add", r[1].Mode);
        Assert.Equal(15, Check("add", Row(2, "a1", "5"))[0].NewStock); // default mode + case-insensitive code
    }

    [Fact]
    public void Same_quantity_is_no_change()
    {
        Assert.Equal("No change", Check("set", Row(2, "A1", "10"))[0].Status);
        Assert.Equal("No change", Check("add", Row(2, "A1", "0"))[0].Status);
    }

    [Theory]
    [InlineData("ZZ9", "5", null, null, "Unknown product code")]
    [InlineData("A1", "abc", null, null, "is not a number")]
    [InlineData("A1", "-3", null, null, "can't be negative")]
    [InlineData("A1", "", null, null, "Quantity is required")]
    [InlineData("A1", "5", "replace-all", null, "Invalid mode")]
    [InlineData("A1", "5", null, "R9-Z9", "Unknown rack location")]
    [InlineData("A1", "2.5", null, null, "whole number")]
    [InlineData("B2", "3", null, null, "reserved for paid orders")]
    [InlineData(null, "5", null, null, "Product code or barcode is required")]
    public void Invalid_rows_are_reported(string? code, string qty, string? mode, string? rack, string error)
    {
        var r = Check("set", Row(2, code, qty, mode, rack)).Single();
        Assert.Equal("Error", r.Status);
        Assert.Contains(r.Errors, e => e.Contains(error));
    }

    [Fact]
    public void Duplicate_product_rows_are_errors_on_every_row()
    {
        var r = Check("set", Row(2, "A1", "5"), Row(3, "B2", "60"), Row(4, "a1", "6"));
        Assert.Equal("Error", r[0].Status); Assert.Equal("Error", r[2].Status); Assert.Equal("OK", r[1].Status);
        Assert.Contains("rows 2, 4", r[0].Errors.Single());
    }

    [Fact]
    public void Barcode_matches_when_code_is_blank_and_ambiguous_barcode_is_rejected()
    {
        Assert.Equal(1, Check("set", Row(2, null, "4", barcode: "890001"))[0].ProductId);
        Assert.Contains("more than one product", Check("set", Row(2, null, "4", barcode: "890999"))[0].Errors.Single());
        Assert.Equal(7, Rack("r1-a1"));
        Assert.Equal("OK", Check("set", Row(2, "A1", "4", rack: "r1-a1"))[0].Status);
    }

    [Theory]
    [InlineData("set", "set")]
    [InlineData(" ADD ", "add")]
    [InlineData("", "set")]
    [InlineData(null, "set")]
    public void Default_mode(string? input, string expected) => Assert.Equal(expected, BulkStockRules.DefaultMode(input));

    [Fact]
    public void Default_mode_rejects_unknown_values() => Assert.Throws<AppException>(() => BulkStockRules.DefaultMode("multiply"));

    [Fact]
    public void Csv_parser_handles_bom_quotes_and_crlf()
    {
        var rows = BulkStockFile.ParseCsv("﻿product_code,quantity,note\r\nA1,5,\"Damaged, 2 \"\"boxes\"\"\"\r\nB2,7,\r\n");
        Assert.Equal(3, rows.Count);
        Assert.Equal("A1|5|Damaged, 2 \"boxes\"", string.Join("|", rows[1]));
        Assert.Equal("", rows[2][2]);
    }

    [Fact]
    public void Csv_file_is_read_by_header_name_and_blank_rows_are_skipped()
    {
        var csv = "Quantity,Mode,Product Code,Rack\n5,add,A1,R1-A1\n,,,\n9,,B2,\n";
        var rows = BulkStockFile.Read(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "stock.csv");
        Assert.Equal(2, rows.Count);
        Assert.Equal(new BulkStockInputRow(2, "A1", null, "5", "add", "R1-A1", null), rows[0]);
        Assert.Equal(4, rows[1].Row);
    }

    [Fact]
    public void File_checks_type_size_and_columns()
    {
        Assert.Contains(".csv or .xlsx", Assert.Throws<AppException>(() => BulkStockFile.Read(new MemoryStream(new byte[] { 1 }), "stock.pdf")).Message);
        Assert.Contains("5 MB", Assert.Throws<AppException>(() => BulkStockFile.Read(new MemoryStream(new byte[BulkStockFile.MaxBytes + 1]), "big.csv")).Message);
        Assert.Contains("quantity column", Assert.Throws<AppException>(() => BulkStockFile.Read(new MemoryStream(Encoding.UTF8.GetBytes("code,amount\nA1,5\n")), "x.csv")).Message);
    }
}
