# MOM
Interface for Multichannel Order Manager for easier, more comprehensive views, searches, and reports, exposed on local work intranet.

# Why this project?
Our company uses an Order Management System called Multichannel Order Manager (MOM). As an older, outdated system, the program can be difficult to use, slow, and is missing many features that are vital for a business. This interface was delveoped to supplement our system and allow us an easier way to search for the information we need to find, collect the data we need to be aware of, and simplify our numerous processes and workarounds.

As MOM does not have an exposed API, this project utilizes local access to our SQL Server to access data. It also uses the ShipStation API to request our shipping data so that we can dependably measure and project profitability, estimate competitive pricing, and also push our pending orders to their dashboard so that our warehouse can quickly input dimensions and print labels without having to worry about the customer's information.

Some of the most important and time-saving features include:
* The ability to view and open multiple pages at a time, whereas in MOM only one window can be open.
* The ability to search records with more comprehensive parameters, such as date, order type, status, and more.
* The ability to quickly navigate to relevant items, orders, POs, etc. by clicking on a link, and the ability to copy and paste text.

## ORDERS
In MOM, orders can only be searched by a complete, unique identifier, such as an order number or alternate order number. Using this interface, users can now query multiple orders at a time by date, order type ("CL key"), order status, salesperson, order total, and SKU.

The order page includes many of the information that can also be found in MOM, but offers a more complete breakdown of each item, such as average unit cost (not displayed at all in MOM), and margin.

The order page also includes a visual break down of total costs and profit, taking shipping costs and any marketplace commission fees into consideration; an easier-to-understand view of order comments; and a history of changes that were made to the order.

## ITEMS
In MOM, items can be searched by complete or incomplete SKU, description, and supplier code. However, the supplier code only applies if the supplier searched is the last supplier that the SKU was purchased from. This interface allows the user to search the same fields, but searches all suppliers for an item when returning the query. It also displays pertinent information, like stock and price, when displaying results.

The item page displays many of the same information that can be found in MOM, but also includes a dynamically calculated minimum recommended price for six marketplaces: Amazon FBM, Amazon FBA, Amazon Vendor Central, Amazon Seller Fulfilled Prime, Walmart, and Ebay. These are calculated based on shipping costs that are generated using the ShipStation API.

The item page also includes a query of sales numbers, in total and by order type; a history of inventory changes and transfers; and a history of user changes made to the item.

## CUSTOMERS
In MOM, customers can only be searched by full and complete last name, phone number, and email address. With this interface, they can now be searched by incomplete first name, last name, company name, email address, or complete zip code.

## LINE ITEMS
In MOM, line items can be searched by status and SKU, but the interface is clunky and confusing. This section reduces the clutter and simplifies the UI.

## PURCHASE ORDERS
In MOM, purchase orders can only be filtered by SKU and supplier&mdash;you can't even search a PO by number. This section allows users to search by PO number, supplier code, PO total, and SKU.

## AP
In MOM, invoices for purchase orders can only be searched by the invoice number. Using this interface, the user can now search by the invoice number, PO number, purchase total, and supplier.

## REPORTS
In MOM, there are no means for profitability reports that take into consideration marketplace fees (such as Amazon FBA, FBM, Walmart, Ebay, etc.) or actual shipping costs. This project includes several types of reports that are designed to catch sales or shipping mistakes that would otherwise lose us money on an order, or to report individual and aggregate profitiability after taking processing costs into consideration.

The Backorder Report also includes a more comprehensive report on backorder items, including the current in-house stock, the number of units currently on active POs, and the orders on which these items are on backorder.

Each report also includes an email option so that managers can get a simplified copy of the information (with link to the corresponding report).

## BATCH
In MOM, orders in certain phases of the order fulfillment process can be viewed from the "batch" feature, where they can then be processed en masse. However, the window in which the specific orders for each phase can be viewed does not allow the user to copy the numbers or click on them to lead them to the order.

This page makes it easy for users to search and inspect each individual order as necessary before processesing them through the batch.
