# MOM
Interface for Multichannel Order Manager for easier, more comprehensive views, searches, and reports, exposed on local work intranet.

# Why this project?
Our company uses an Order Management System called Multichannel Order Manager (MOM). As an older, outdated system, the program can be difficult to use, slow, and is missing many features that are vital for a business. This interface was delveoped to supplement our system and allow us an easier way to search for the information we need to find, collect the data we need to be aware of, and simplify our numerous processes and workarounds.

As MOM does not have an exposed API, this project utilizes local access to our SQL Server to access data. It also uses the ShipStation API to request our shipping data. The ShipStation API is also used to export our orders into ShipStation in a separate module.

## ORDERS
In MOM, orders can only be searched by a complete, unique identifier, such as an order number or alternate order number. Using this interface, users can now query multiple orders at a time by date, order type ("CL key"), order status, salesperson, order total, and SKU.

## ITEMS
In MOM, items can be searched by complete or incomplete SKU, description, and supplier code. However, the supplier code only applies if the supplier searched is the last supplier that the SKU was purchased from. This interface allows the user to search the same fields, but searches all suppliers for an item when returning the query. It also displays pertinent information, like stock and price, when displaying results.

## CUSTOMERS
In MOM, customers can only be searched by full and complete last name, phone number, and email address. With this interface, they can now be searched by incomplete first name, last name, company name, email address, or complete zip code.

## LINE ITEMS
In MOM, line items can be searched by status and SKU, but the interface is clunky and confusing. This project reduces the clutter and simplifies the UI.

## PURCHASE ORDERS
In MOM, purchase orders can only be filtered by SKU and supplier&mdash;you can't even search a PO by number. This project allows users to search by PO number, supplier code, PO total, and SKU.

## AP

## REPORTS

## BATCH
