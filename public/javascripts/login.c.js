var login = new PageUtils( 1, "LOGIN", 0, 0, 0 );

// DOM Ready =============================================================


$(document).ready(function() {

	var page = login;

	var msg_elem = $( '#msg' )[0];
	var target_url_elem = $( '#target_url' )[0];

	if (msg_elem && (msg_elem.value != undefined) && (msg_elem.value != "")) {
		page.showError(0,msg_elem.value);
	} else {
		page.clearError();
	}
	
	 // Send hashed password by replacing password in form on submit.
	 $("form").on("submit",function() {
		 var pwd_field = $(this).find("input[name=password]");
		var encrypted = CryptoJS.SHA256(pwd_field.val())
		console.log("HEY: encrypted="+encrypted);
		pwd_field.val(encrypted); 
	});
});

// Functions =============================================================


