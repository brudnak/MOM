var app = angular.module('MyApp', ['ngMaterial', 'ngMessages']);

app.controller('AppCtrl', function($window) {
    this.goto = function(path) {
        $window.location.href = path;
    }
});

app.filter('dateFromSQL', () => {
    return function(x) {
        return x.substring(2,4) + '/' + x.substring(4,6) + '/' + x.substring(0,2);
    }
})
 
app.filter('orderStatus', () => {
    return function(x) {
        const ordstatus = {
            QO: 'Quote',
            CM: 'Committed',
            PI: 'Ready to Pick',
            PS: 'Ready to Ship',
            SH: 'Shipped',
            ND: 'Dropship',
            OR: 'On Review',
            BO: 'Back Order',
            UO: 'User Hold',
            PE: 'Permanent Hold',
            EP: 'No Status',
            CN: 'Canceled',
            IN: 'Ready to Pack',
            NW: 'Need Weighing',
            BI: 'Ready to Invoice'
        }
        console.log('hi')
        return ordstatus[x] || x;
    }
})

app.directive('dateNow', ['$filter', function($filter) {
    return {
        link: function( $scope, $element, $attrs) {
        $element.text($filter('date')(new Date(), $attrs.dateNow));
        }
    };
}])

app.controller('backorderReportCtrl', function() {
    this.bottomDollar = 2;
    this.bottomPercent = 10;
    this.startDate = new Date();
    this.endDate = new Date();
    this.startDate.setDate(this.startDate.getDate() - 1);
    this.clKeys = ['AMAZON','AMZPRIME','AMZVC','BID','EBAY','EBAYCPR','EMAIL','FAI','GRANT','GROUPON','GS','PAYPAL','PHONE','PO','TRN','WAL','WEBSALE'];
    this.selectedKeys = ['AMAZON','AMZPRIME','AMZVC','BID','EBAY','EBAYCPR','EMAIL','FAI','GRANT','GROUPON','GS','PAYPAL','PHONE','PO','TRN','WAL','WEBSALE'];

    this.toggleSelection = key => {
        const i = this.selectedKeys.indexOf(key);
        if(i > -1) {
            this.selectedKeys.splice(i, 1);
        } else {
            this.selectedKeys.push(key);
        }
    }
});


$(document).keypress(function(e) {
    if ((e.keyCode || e.which) == 13) {
        // Enter key pressed
        $('a#submit').click();
    }
});



