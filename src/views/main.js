$(document).ready(()=>{
    $("#submit").on('click', ()=> {
        var username = $("#username").val()
        var password = $("#password").val()
        if(username != "" && password != "") {
            $("#submit").addClass('is-loading')
            $.ajax({
                url: '/login-admin',
                type:'POST',
                data: {
                    username,
                    password
                },
                dataType: 'json'
            }).done((data)=>{
                $("#submit").removeClass('is-loading')
                localStorage.setItem('userItem' , JSON.stringify(data))
                window.location = '/playground?key=' + data.token
            }).catch(()=>{
                $("#submit").removeClass('is-loading')
                alert('Username or password incorrect')
            })
        }
    })
})

